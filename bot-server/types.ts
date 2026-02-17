
export const INITIAL_CREDITS = 30;

export enum AppState {
    NEW_USER = 'NEW_USER',
    AWAITING_LANGUAGE = 'AWAITING_LANGUAGE',
    AWAITING_MODEL_IMAGE = 'AWAITING_MODEL_IMAGE',
    AWAITING_OUTFITS = 'AWAITING_OUTFITS',
    GENERATING = 'GENERATING',
    COMPLETED = 'COMPLETED',
}

export enum ItemCategory {
    OUTFIT = 'outfit',
    SHOES = 'shoes',
    HANDBAG = 'handbag',
    HAT = 'hat',
    ACCESSORY = 'accessory',
    BACKGROUND = 'background',
    UNKNOWN = 'unknown'
}

export type Language = 'uz' | 'ru';

export interface OutfitItem {
    id: string;
    category: ItemCategory;
    description: string;
    base64: string;
    mimeType: string;
    containsPerson?: boolean;
}

export interface ValidationResult {
    valid: boolean;
    reason?: string;
    gender?: 'male' | 'female';
}

export interface CategorizationResult {
    category: ItemCategory;
    description: string;
    isProhibited: boolean;
    gender: 'male' | 'female' | 'unisex';
    containsPerson: boolean;
}

export interface UserSession {
    chatId: number;
    username?: string;
    state: AppState;
    language?: Language;
    modelImage: string | null;
    originalModelImage: string | null;
    modelGender?: 'male' | 'female';
    outfitItems: OutfitItem[];
    lastActivity: number;
    credits: number;
    lastMonthlyGrant?: string;
    photoBuffer: string[];
    bufferTimeout: any;
}

export interface TelegramUpdate {
    update_id: number;
    message?: {
        message_id: number;
        from: {
            id: number;
            username?: string;
            first_name?: string;
        };
        chat: {
            id: number;
        };
        text?: string;
        photo?: {
            file_id: string;
            file_unique_id: string;
            width: number;
            height: number;
            file_size?: number;
        }[];
        successful_payment?: {
            currency: string;
            total_amount: number;
            invoice_payload: string;
        };
    };
    callback_query?: {
        id: string;
        from: {
            id: number;
            first_name: string;
        };
        message?: {
            chat: {
                id: number;
            };
            message_id: number;
        };
        data: string;
    };
    pre_checkout_query?: {
        id: string;
        from: {
            id: number;
        };
        currency: string;
        total_amount: number;
        invoice_payload: string;
    };
}

// --- Analytics Types ---

export type DateRangeFilter = 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'all';

export interface UserAnalyticsProfile {
    chatId: number;
    username: string;
    firstName: string;
    joinedAt: number;
    lastActiveAt: number;
    generatedImagesCount: number;
    purchasedCredits: number;
    totalPaidAmount: number;
    totalApiCost: number;
}

export interface DailyMetrics {
    newUsers: number;
    funnelStarted: number;
    funnelModelUploaded: number;
    funnelOutfitUploaded: number;
    funnelGenerationRequested: number;
    funnelCompleted: number;
    totalGenerations: number;
    successfulGenerations: number;
    failedGenerations: number;
    modelValidationAttempts: number;
    modelValidationSuccess: number;
    totalCost: number;
    errorCounts: Record<string, number>;
}

export interface AnalyticsMetrics {
    totalUsers: number;
    activeUsersToday: number;
    newUsersToday: number;

    // Funnel
    funnelStarted: number;
    funnelModelUploaded: number;
    funnelOutfitUploaded: number;
    funnelGenerationRequested: number;
    funnelCompleted: number;

    // Generation Stats
    totalGenerations: number;
    successfulGenerations: number;
    failedGenerations: number;

    // Validation Stats
    modelValidationAttempts: number;
    modelValidationSuccess: number;

    // Costs
    totalCost: number;

    // Errors
    errorCounts: Record<string, number>;

    // Timestamps
    lastUpdated: number;

    // Historical Data (Key = YYYY-MM-DD)
    history: Record<string, DailyMetrics>;
}
