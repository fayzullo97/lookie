
import { UserSession, AppState, INITIAL_CREDITS_VAL, ItemCategory, OutfitItem } from "../types";
import { supabase } from "./supabaseClient";

class SessionService {
    // In-memory cache for ephemeral state (buffers, timeouts, outfit items)
    private ephemeralSessions: Record<number, {
        photoBuffer: string[],
        bufferTimeout: any,
        outfitItems: OutfitItem[],
        modelImage: string | null,
        originalModelImage: string | null,
        surveyAnswers: Record<string, any>
    }> = {};

    private getEphemeral(chatId: number) {
        if (!this.ephemeralSessions[chatId]) {
            this.ephemeralSessions[chatId] = {
                photoBuffer: [],
                bufferTimeout: null,
                outfitItems: [],
                modelImage: null,
                originalModelImage: null,
                surveyAnswers: {}
            };
        }
        return this.ephemeralSessions[chatId];
    }

    public async getOrCreateSession(chatId: number, userInfo?: { username?: string, first_name?: string }): Promise<UserSession> {
        // 1. Try to get from Supabase
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', chatId)
            .single();

        if (error || !user) {
            console.log(`[DB] User ${chatId} not found (${error?.code || 'no data'}). Creating...`);
            // 2. Create if not exists
            const newUser = {
                id: chatId,
                username: userInfo?.username || null,
                first_name: userInfo?.first_name || null,
                credits: INITIAL_CREDITS_VAL,
                current_state: AppState.NEW_USER,
                last_active_at: new Date().toISOString()
            };

            const { data: created, error: createError } = await supabase
                .from('users')
                .insert([newUser])
                .select()
                .single();

            if (createError) {
                console.error(`[DB] ❌ FAILED to create user ${chatId}:`, createError.message, createError.details, createError.hint);
                // Return a minimal in-memory session so the bot doesn't crash
                const ephemeral = this.getEphemeral(chatId);
                return {
                    chatId,
                    username: userInfo?.username,
                    state: AppState.NEW_USER,
                    language: undefined,
                    modelImage: null,
                    originalModelImage: null,
                    modelGender: undefined,
                    outfitItems: [],
                    lastActivity: Date.now(),
                    credits: INITIAL_CREDITS_VAL,
                    lastMonthlyGrant: undefined,
                    photoBuffer: ephemeral.photoBuffer,
                    bufferTimeout: ephemeral.bufferTimeout
                };
            }

            console.log(`[DB] ✅ Created user ${chatId} in Supabase.`);
            return this.mapDbToSession(created);
        }

        console.log(`[DB] User ${chatId} found. State: ${user.current_state}`);
        return this.mapDbToSession(user);
    }

    public async updateSession(chatId: number, updates: Partial<UserSession>): Promise<void> {
        const ephemeral = this.getEphemeral(chatId);

        // Update ephemeral state IMMEDIATELY (before any async DB call)
        if (updates.photoBuffer !== undefined) {
            ephemeral.photoBuffer = updates.photoBuffer;
        }
        if (updates.bufferTimeout !== undefined) {
            ephemeral.bufferTimeout = updates.bufferTimeout;
        }
        if (updates.outfitItems !== undefined) {
            ephemeral.outfitItems = updates.outfitItems;
        }
        if (updates.modelImage !== undefined) {
            ephemeral.modelImage = updates.modelImage;
        }
        if (updates.originalModelImage !== undefined) {
            ephemeral.originalModelImage = updates.originalModelImage;
        }
        if (updates.surveyAnswers !== undefined) {
            ephemeral.surveyAnswers = updates.surveyAnswers;
        }

        // Build DB updates
        const dbUpdates: any = {};
        let shouldUpdateDb = false;

        if (updates.state) { dbUpdates.current_state = updates.state; shouldUpdateDb = true; }
        if (updates.language) { dbUpdates.language = updates.language; shouldUpdateDb = true; }
        if (updates.credits !== undefined) { dbUpdates.credits = updates.credits; shouldUpdateDb = true; }
        if (updates.modelGender) { dbUpdates.model_gender = updates.modelGender; shouldUpdateDb = true; }
        if (updates.lastMonthlyGrant) { dbUpdates.last_monthly_grant = updates.lastMonthlyGrant; shouldUpdateDb = true; }

        if (shouldUpdateDb) {
            dbUpdates.last_active_at = new Date().toISOString();
            const { error } = await supabase
                .from('users')
                .update(dbUpdates)
                .eq('id', chatId);

            if (error) {
                console.error(`[DB] ❌ Failed to update user ${chatId}:`, error.message, error.details);
            } else {
                console.log(`[DB] Updated user ${chatId}:`, Object.keys(dbUpdates).join(', '));
            }
        }
    }

    public async getSession(chatId: number): Promise<UserSession | undefined> {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', chatId)
            .single();

        if (error || !user) {
            console.error(`[DB] getSession failed for ${chatId}:`, error?.message);
            // Try to return ephemeral-only session if we have one
            const ephemeral = this.ephemeralSessions[chatId];
            if (ephemeral) {
                console.log(`[DB] Returning ephemeral-only session for ${chatId}`);
                return {
                    chatId,
                    state: AppState.NEW_USER,
                    language: undefined,
                    modelImage: ephemeral.modelImage,
                    originalModelImage: ephemeral.originalModelImage,
                    modelGender: undefined,
                    outfitItems: ephemeral.outfitItems,
                    lastActivity: Date.now(),
                    credits: INITIAL_CREDITS_VAL,
                    photoBuffer: ephemeral.photoBuffer,
                    bufferTimeout: ephemeral.bufferTimeout,
                    surveyAnswers: ephemeral.surveyAnswers
                };
            }
            return undefined;
        }
        return this.mapDbToSession(user);
    }

    private async mapDbToSession(user: any): Promise<UserSession> {
        const chatId = Number(user.id);
        const ephemeral = this.getEphemeral(chatId);

        // Fetch current model image from DB
        const { data: modelData, error: modelError } = await supabase
            .from('model_images')
            .select('*')
            .eq('user_id', chatId)
            .eq('is_current', true)
            .single();

        if (modelError && modelError.code !== 'PGRST116') {
            // PGRST116 = "no rows returned" which is normal for new users
            console.error(`[DB] Error fetching model image for ${chatId}:`, modelError.message);
        }

        const dbModelImage = modelData?.storage_path || null;

        // Use ephemeral modelImage if set (more recent), otherwise DB
        const modelImage = ephemeral.modelImage || dbModelImage;
        const originalModelImage = ephemeral.originalModelImage || dbModelImage;

        // Fetch outfit items from queue
        const { data: outfitData, error: outfitError } = await supabase
            .from('outfit_queue')
            .select('*')
            .eq('user_id', chatId);

        if (outfitError) {
            console.error(`[DB] Error fetching outfit queue for ${chatId}:`, outfitError.message);
        }

        // Use ephemeral outfit items if they exist, otherwise DB
        let outfitItems: OutfitItem[];
        if (ephemeral.outfitItems.length > 0) {
            outfitItems = ephemeral.outfitItems;
        } else {
            outfitItems = (outfitData || []).map(item => ({
                id: item.id,
                category: item.category as ItemCategory,
                description: item.description || '',
                base64: item.storage_path || '',
                mimeType: item.mime_type || 'image/jpeg'
            }));
        }

        return {
            chatId,
            username: user.username,
            state: user.current_state as AppState,
            language: user.language,
            modelImage,
            originalModelImage,
            modelGender: user.model_gender,
            outfitItems,
            lastActivity: new Date(user.last_active_at || Date.now()).getTime(),
            credits: user.credits,
            lastMonthlyGrant: user.last_monthly_grant,
            photoBuffer: ephemeral.photoBuffer,
            bufferTimeout: ephemeral.bufferTimeout,
            surveyAnswers: ephemeral.surveyAnswers
        };
    }
}

export const sessionService = new SessionService();
