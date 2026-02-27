
import { AnalyticsMetrics, UserAnalyticsProfile, DateRangeFilter, SurveyResponse } from "../types";
import { supabase } from "./supabaseClient";

function getDateRangeStart(filter: DateRangeFilter): string | null {
    const now = new Date();
    switch (filter) {
        case 'today': {
            const d = new Date(now); d.setHours(0, 0, 0, 0);
            return d.toISOString();
        }
        case 'yesterday': {
            const d = new Date(now); d.setDate(d.getDate() - 1); d.setHours(0, 0, 0, 0);
            return d.toISOString();
        }
        case '7d': {
            const d = new Date(now); d.setDate(d.getDate() - 7);
            return d.toISOString();
        }
        case '30d': {
            const d = new Date(now); d.setDate(d.getDate() - 30);
            return d.toISOString();
        }
        case '90d': {
            const d = new Date(now); d.setDate(d.getDate() - 90);
            return d.toISOString();
        }
        case 'all':
        default:
            return null;
    }
}

class AnalyticsService {
    public async getMetrics(filter: DateRangeFilter = 'all'): Promise<AnalyticsMetrics> {
        const rangeStart = getDateRangeStart(filter);

        // 1. Total users
        const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });

        // 2. Active users (last_active_at today)
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const { count: activeUsersToday } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .gte('last_active_at', todayStart.toISOString());

        // 3. New users today
        const { count: newUsersToday } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', todayStart.toISOString());

        // 4. Generations with date filter
        let genQuery = supabase.from('generations').select('status, cost_usd_est');
        if (rangeStart) genQuery = genQuery.gte('created_at', rangeStart);
        const { data: genData } = await genQuery;

        let totalGenerations = 0;
        let successfulGenerations = 0;
        let failedGenerations = 0;
        let totalCost = 0;

        (genData || []).forEach(row => {
            totalGenerations++;
            if (row.status === 'success') successfulGenerations++;
            else failedGenerations++;
            totalCost += Number(row.cost_usd_est) || 0;
        });

        // 5. Funnel metrics
        // Users who uploaded model
        let modelQuery = supabase.from('model_images').select('user_id');
        if (rangeStart) modelQuery = modelQuery.gte('created_at', rangeStart);
        const { data: modelData } = await modelQuery;
        const usersWithModel = new Set((modelData || []).map(r => r.user_id)).size;

        // Users who uploaded outfit items
        let outfitQuery = supabase.from('outfit_queue').select('user_id');
        if (rangeStart) outfitQuery = outfitQuery.gte('created_at', rangeStart);
        const { data: outfitData } = await outfitQuery;
        const usersWithOutfit = new Set((outfitData || []).map(r => r.user_id)).size;

        // Model validation attempts (approximate: count model_images entries)
        const modelValidationAttempts = (modelData || []).length;

        // 6. Historical data
        const { data: historyData } = await supabase.from('daily_metrics_view').select('*');
        const history: Record<string, any> = {};
        (historyData || []).forEach(row => {
            const dateStr = new Date(row.date).toISOString().split('T')[0];
            history[dateStr] = {
                totalGenerations: row.total_gens,
                successfulGenerations: row.success_gens,
                failedGenerations: row.total_gens - row.success_gens,
            };
        });

        return {
            totalUsers: totalUsers || 0,
            activeUsersToday: activeUsersToday || 0,
            newUsersToday: newUsersToday || 0,
            funnelStarted: totalUsers || 0,
            funnelModelUploaded: usersWithModel,
            funnelOutfitUploaded: usersWithOutfit,
            funnelGenerationRequested: totalGenerations,
            funnelCompleted: successfulGenerations,
            totalGenerations,
            successfulGenerations,
            failedGenerations,
            modelValidationAttempts,
            modelValidationSuccess: usersWithModel,
            totalCost,
            errorCounts: {},
            lastUpdated: Date.now(),
            history
        } as any;
    }

    public async getUserProfiles(): Promise<UserAnalyticsProfile[]> {
        // Fetch users
        const { data: users, error } = await supabase
            .from('users')
            .select('id, username, first_name, created_at, last_active_at')
            .order('last_active_at', { ascending: false });

        if (error || !users) return [];

        // Fetch generation counts and costs per user
        const { data: genStats } = await supabase
            .from('generations')
            .select('user_id, cost_usd_est');

        // Build per-user generation stats
        const genCountMap = new Map<number, number>();
        const genCostMap = new Map<number, number>();
        (genStats || []).forEach((g: any) => {
            const uid = Number(g.user_id);
            genCountMap.set(uid, (genCountMap.get(uid) || 0) + 1);
            genCostMap.set(uid, (genCostMap.get(uid) || 0) + (Number(g.cost_usd_est) || 0));
        });

        // Fetch transaction data
        const { data: txData } = await supabase
            .from('transactions')
            .select('user_id, amount, amount_paid_uzs');

        const paidMap = new Map<number, number>();
        const creditsMap = new Map<number, number>();
        (txData || []).forEach((t: any) => {
            const uid = Number(t.user_id);
            paidMap.set(uid, (paidMap.get(uid) || 0) + (t.amount_paid_uzs || 0));
            if (t.amount > 0) {
                creditsMap.set(uid, (creditsMap.get(uid) || 0) + t.amount);
            }
        });

        return users.map((u: any) => ({
            chatId: Number(u.id),
            username: u.username || 'Unknown',
            firstName: u.first_name || 'User',
            joinedAt: new Date(u.created_at).getTime(),
            lastActiveAt: new Date(u.last_active_at).getTime(),
            generatedImagesCount: genCountMap.get(Number(u.id)) || 0,
            purchasedCredits: creditsMap.get(Number(u.id)) || 0,
            totalPaidAmount: paidMap.get(Number(u.id)) || 0,
            totalApiCost: genCostMap.get(Number(u.id)) || 0
        }));
    }

    public async trackUserActivity(chatId: number, userInfo?: { username?: string, firstName?: string }) {
        await supabase.from('users').update({
            last_active_at: new Date().toISOString(),
            username: userInfo?.username,
            first_name: userInfo?.firstName
        }).eq('id', chatId);
    }

    public trackFunnelStep(_step: string) {
        // Funnel is now derived from table states
    }

    public async trackModelValidation(userId: number, success: boolean) {
        // Validation events are tracked via model_images table
    }

    public async trackGeneration(userId: number, success: boolean, details?: { prompt: string, costUsd: number, costCredits: number, error?: string, path?: string }) {
        await supabase.from('generations').insert([{
            user_id: userId,
            input_prompt: details?.prompt,
            status: success ? 'success' : (details?.error === 'Safety Block' ? 'safety_block' : 'failed'),
            error_message: details?.error,
            cost_credits: details?.costCredits || 10,
            cost_usd_est: details?.costUsd || 0.04,
            result_image_path: details?.path
        }]);
    }

    public async trackPayment(userId: number, amount: number, credits: number, providerId?: string) {
        await supabase.from('transactions').insert([{
            user_id: userId,
            amount: credits,
            type: 'purchase',
            amount_paid_uzs: amount,
            provider_id: providerId
        }]);
    }

    public trackError(_type: string) {
        // Errors could be logged to a 'system_errors' table
    }

    public async saveSurveyResponse(response: Omit<SurveyResponse, 'id' | 'created_at'>): Promise<void> {
        const { error } = await supabase.from('survey_responses').insert([response]);
        if (error) {
            console.error('[DB] Error saving survey response:', error.message);
            throw error;
        }
    }

    public async getSurveyResponses(): Promise<SurveyResponse[]> {
        const { data, error } = await supabase
            .from('survey_responses')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[DB] Error fetching survey responses:', error.message);
            return [];
        }
        return data as SurveyResponse[];
    }

    public async getPromoData(): Promise<{ codes: any[], redemptions: any[] }> {
        // Fetch all promo codes with user info
        const { data: codes } = await supabase
            .from('promo_codes')
            .select('code, user_id, created_at')
            .order('created_at', { ascending: false });

        // Fetch all redemptions with user info
        const { data: redemptions } = await supabase
            .from('promo_redemptions')
            .select('code, redeemed_by, owner_id, created_at')
            .order('created_at', { ascending: false });

        // Fetch user info for all relevant user IDs
        const allIds = new Set<number>();
        (codes || []).forEach(c => allIds.add(c.user_id));
        (redemptions || []).forEach(r => { allIds.add(r.redeemed_by); allIds.add(r.owner_id); });

        const { data: usersData } = await supabase
            .from('users')
            .select('id, username, first_name')
            .in('id', Array.from(allIds));

        const userMap = new Map<number, { username: string, firstName: string }>();
        (usersData || []).forEach((u: any) => {
            userMap.set(Number(u.id), { username: u.username || 'Unknown', firstName: u.first_name || 'User' });
        });

        const enrichedCodes = (codes || []).map(c => ({
            code: c.code,
            userId: c.user_id,
            username: userMap.get(c.user_id)?.username || 'Unknown',
            firstName: userMap.get(c.user_id)?.firstName || 'User',
            createdAt: c.created_at,
            redemptionCount: (redemptions || []).filter(r => r.code === c.code).length
        }));

        const enrichedRedemptions = (redemptions || []).map(r => ({
            code: r.code,
            redeemedBy: r.redeemed_by,
            redeemerName: userMap.get(r.redeemed_by)?.firstName || 'User',
            redeemerUsername: userMap.get(r.redeemed_by)?.username || 'Unknown',
            ownerId: r.owner_id,
            ownerName: userMap.get(r.owner_id)?.firstName || 'User',
            ownerUsername: userMap.get(r.owner_id)?.username || 'Unknown',
            createdAt: r.created_at
        }));

        return { codes: enrichedCodes, redemptions: enrichedRedemptions };
    }
}

export const analytics = new AnalyticsService();
