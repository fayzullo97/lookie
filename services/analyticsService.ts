
import { AnalyticsMetrics, UserAnalyticsProfile, DateRangeFilter } from "../types";

const API_BASE = (import.meta as any).env.VITE_API_URL || 'http://localhost:3001';

class AnalyticsService {
  public async getMetrics(filter: DateRangeFilter = 'all'): Promise<AnalyticsMetrics> {
    try {
      const res = await fetch(`${API_BASE}/metrics?filter=${filter}`);
      return await res.json();
    } catch (e) {
      console.error("Failed to fetch metrics", e);
      throw e;
    }
  }

  public async getUserProfiles(): Promise<UserAnalyticsProfile[]> {
    try {
      const res = await fetch(`${API_BASE}/profiles`);
      return await res.json();
    } catch (e) {
      console.error("Failed to fetch profiles", e);
      throw e;
    }
  }

  public async giftCredits(chatId: number, amount: number) {
    try {
      const res = await fetch(`${API_BASE}/gift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, amount })
      });
      return await res.json();
    } catch (e) {
      console.error("Failed to gift credits", e);
      throw e;
    }
  }

  // --- No-op methods for compatibility with existing tracking calls in UI (if any) ---
  public trackUserActivity() { }
  public trackFunnelStep() { }
  public trackModelValidation() { }
  public trackGeneration() { }
  public trackPayment() { }
  public trackError() { }
}

export const analytics = new AnalyticsService();
