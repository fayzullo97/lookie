
import { UserSession, AppState, INITIAL_CREDITS } from "../types";
import { storage } from "./storageService";

const SESSIONS_KEY = 'bot_sessions';

export const INITIAL_CREDITS_VAL = 30;

class SessionService {
    private sessions: Record<number, UserSession>;

    constructor() {
        this.sessions = this.loadSessions();
    }

    private loadSessions(): Record<number, UserSession> {
        try {
            const stored = storage.getItem(SESSIONS_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            return {};
        }
    }

    private saveSessions() {
        storage.setItem(SESSIONS_KEY, JSON.stringify(this.sessions));
    }

    public getOrCreateSession(chatId: number, userInfo?: { username?: string }): UserSession {
        if (!this.sessions[chatId]) {
            this.sessions[chatId] = {
                chatId,
                username: userInfo?.username,
                state: AppState.NEW_USER,
                modelImage: null,
                originalModelImage: null,
                outfitItems: [],
                lastActivity: Date.now(),
                credits: INITIAL_CREDITS_VAL,
                photoBuffer: [],
                bufferTimeout: null
            };
            this.saveSessions();
        }
        return this.sessions[chatId];
    }

    public updateSession(chatId: number, updates: Partial<UserSession>) {
        if (this.sessions[chatId]) {
            // Don't persist bufferTimeout
            const { bufferTimeout, ...rest } = updates;
            this.sessions[chatId] = { ...this.sessions[chatId], ...rest };
            this.saveSessions();
        }
    }

    public getSession(chatId: number): UserSession | undefined {
        return this.sessions[chatId];
    }

    public getAllSessions(): Record<number, UserSession> {
        return this.sessions;
    }
}

export const sessionService = new SessionService();
