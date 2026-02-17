
import { UserSession, AppState, INITIAL_CREDITS_VAL, ItemCategory, OutfitItem } from "../types";
import { supabase } from "./supabaseClient";

class SessionService {
    // In-memory cache for buffers and quick access
    private ephemeralSessions: Record<number, { photoBuffer: string[], bufferTimeout: any }> = {};

    public async getOrCreateSession(chatId: number, userInfo?: { username?: string, first_name?: string }): Promise<UserSession> {
        // 1. Try to get from Supabase
        let { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', chatId)
            .single();

        if (error || !user) {
            // 2. Create if not exists
            const newUser = {
                id: chatId,
                username: userInfo?.username,
                first_name: userInfo?.first_name,
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
                console.error("Error creating user:", createError);
                // Fallback to minimal session if DB fails (not ideal)
            }
            user = created || newUser;
        }

        // Initialize ephemeral state if needed
        if (!this.ephemeralSessions[chatId]) {
            this.ephemeralSessions[chatId] = { photoBuffer: [], bufferTimeout: null };
        }

        // 3. Map DB user to UserSession
        return this.mapDbToSession(user);
    }

    public async updateSession(chatId: number, updates: Partial<UserSession>): Promise<void> {
        const dbUpdates: any = {};

        if (updates.state) dbUpdates.current_state = updates.state;
        if (updates.language) dbUpdates.language = updates.language;
        if (updates.credits !== undefined) dbUpdates.credits = updates.credits;
        if (updates.modelGender) dbUpdates.model_gender = updates.modelGender;
        if (updates.lastMonthlyGrant) dbUpdates.last_monthly_grant = updates.lastMonthlyGrant;

        dbUpdates.last_active_at = new Date().toISOString();

        if (Object.keys(dbUpdates).length > 0) {
            await supabase
                .from('users')
                .update(dbUpdates)
                .eq('id', chatId);
        }

        // Update ephemeral state
        if (updates.photoBuffer !== undefined) {
            this.ephemeralSessions[chatId] = {
                ...this.ephemeralSessions[chatId],
                photoBuffer: updates.photoBuffer
            };
        }
        if (updates.bufferTimeout !== undefined) {
            this.ephemeralSessions[chatId] = {
                ...this.ephemeralSessions[chatId],
                bufferTimeout: updates.bufferTimeout
            };
        }
    }

    public async getSession(chatId: number): Promise<UserSession | undefined> {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', chatId)
            .single();

        if (error || !user) return undefined;
        return this.mapDbToSession(user);
    }

    private async mapDbToSession(user: any): Promise<UserSession> {
        const chatId = Number(user.id);
        const ephemeral = this.ephemeralSessions[chatId] || { photoBuffer: [], bufferTimeout: null };

        // Fetch outfit items from queue
        const { data: outfitData } = await supabase
            .from('outfit_queue')
            .select('*')
            .eq('user_id', chatId);

        const outfitItems: OutfitItem[] = (outfitData || []).map(item => ({
            id: item.id,
            category: item.category as ItemCategory,
            description: item.description || '',
            base64: '', // We should probably store storage paths, but for now keeping base64 empty if not needed in memory
            mimeType: item.mime_type || 'image/jpeg'
        }));

        // Fetch current model image
        const { data: modelData } = await supabase
            .from('model_images')
            .select('*')
            .eq('user_id', chatId)
            .eq('is_current', true)
            .single();

        return {
            chatId,
            username: user.username,
            state: user.current_state as AppState,
            language: user.language,
            modelImage: modelData?.storage_path || null,
            originalModelImage: null, // Logic for this can be added later
            modelGender: user.model_gender,
            outfitItems,
            lastActivity: new Date(user.last_active_at || Date.now()).getTime(),
            credits: user.credits,
            lastMonthlyGrant: user.last_monthly_grant,
            photoBuffer: ephemeral.photoBuffer,
            bufferTimeout: ephemeral.bufferTimeout
        };
    }
}

export const sessionService = new SessionService();
