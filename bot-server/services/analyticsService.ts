
import { AnalyticsMetrics, UserAnalyticsProfile, DateRangeFilter, SurveyResponse } from "../types";
import { supabase } from "./supabaseClient";

class AnalyticsService {
    public async getMetrics(filter: DateRangeFilter = 'all'): Promise<AnalyticsMetrics> {
        // 1. Fetch Funnel Metrics from the funnel_view
        const { data: funnelData } = await supabase.from('funnel_view').select('*').single();

        // 2. Fetch Daily Metrics (Historical)
        const { data: historyData } = await supabase.from('daily_metrics_view').select('*');

        // 3. Aggregate for current request
        // Note: For simplicity, we are mapping what we can. 
        // Some granular funnel steps from the old memory version might not be in the base schema 
        // unless we add specific log tables for them.

        const history: Record<string, any> = {};
        let totalCost = 0;
        let totalGenerations = 0;
        let successfulGenerations = 0;
        let failedGenerations = 0;

        (historyData || []).forEach(row => {
            const dateStr = new Date(row.date).toISOString().split('T')[0];
            history[dateStr] = {
                totalGenerations: row.total_gens,
                successfulGenerations: row.success_gens,
                failedGenerations: row.total_gens - row.success_gens,
            };
            totalGenerations += row.total_gens;
            successfulGenerations += row.success_gens;
            failedGenerations += (row.total_gens - row.success_gens);
        });

        // Fetch costs from generations table
        const { data: costData } = await supabase.rpc('sum_generation_costs');
        // If RPC isn't available, we'd do a select sum, but for now let's just use 0 or a simple query
        const { data: costSum } = await supabase.from('generations').select('cost_usd_est');
        totalCost = (costSum || []).reduce((acc, curr) => acc + (Number(curr.cost_usd_est) || 0), 0);

        return {
            totalUsers: funnelData?.total_users || 0,
            activeUsersToday: 0, // Would need a DAU query
            newUsersToday: 0,
            funnelStarted: funnelData?.total_users || 0,
            funnelModelUploaded: funnelData?.users_with_model || 0,
            funnelOutfitUploaded: 0, // Would need a query on outfit_queue
            funnelGenerationRequested: totalGenerations,
            funnelCompleted: successfulGenerations,
            totalGenerations,
            successfulGenerations,
            failedGenerations,
            modelValidationAttempts: 0,
            modelValidationSuccess: funnelData?.users_with_model || 0,
            totalCost,
            errorCounts: {},
            lastUpdated: Date.now(),
            history
        } as any;
    }

    public async getUserProfiles(): Promise<UserAnalyticsProfile[]> {
        const { data: users, error } = await supabase
            .from('users')
            .select(`
                id,
                username,
                first_name,
                created_at,
                last_active_at,
                generations(count),
                transactions(amount, amount_paid_uzs)
            `)
            .order('last_active_at', { ascending: false });

        if (error || !users) return [];

        return users.map((u: any) => {
            const totalPaid = u.transactions
                ? u.transactions.reduce((acc: number, t: any) => acc + (t.amount_paid_uzs || 0), 0)
                : 0;
            const purchasedCredits = u.transactions
                ? u.transactions.filter((t: any) => t.amount > 0).reduce((acc: number, t: any) => acc + t.amount, 0)
                : 0;

            return {
                chatId: Number(u.id),
                username: u.username || 'Unknown',
                firstName: u.first_name || 'User',
                joinedAt: new Date(u.created_at).getTime(),
                lastActiveAt: new Date(u.last_active_at).getTime(),
                generatedImagesCount: u.generations?.[0]?.count || 0,
                purchasedCredits,
                totalPaidAmount: totalPaid,
                totalApiCost: 0 // Would need detailed generation cost sum per user
            };
        });
    }

    public async trackUserActivity(chatId: number, userInfo?: { username?: string, firstName?: string }) {
        await supabase.from('users').update({
            last_active_at: new Date().toISOString(),
            username: userInfo?.username,
            first_name: userInfo?.firstName
        }).eq('id', chatId);
    }

    public trackFunnelStep(_step: string) {
        // Funnel is now derived from table states, but we could log to a 'logs' table if needed
    }

    public async trackModelValidation(userId: number, success: boolean) {
        // Validation events could be logged to a separate table if needed for analytics
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
}

export const analytics = new AnalyticsService();
