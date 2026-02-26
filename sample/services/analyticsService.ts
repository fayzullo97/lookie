
import { AnalyticsMetrics, UserAnalyticsProfile, DateRangeFilter, DailyMetrics } from "../types";

const STORAGE_KEY = 'bot_analytics_v1';
const PROFILES_KEY = 'bot_analytics_profiles';
const USERS_KEY = 'bot_analytics_users'; // Store set of user IDs
const DAILY_ACTIVE_KEY = 'bot_analytics_dau_'; // Suffix with date

// Estimated Costs (USD)
const COST_VISION_INPUT = 0.002;
const COST_GPT_INPUT = 0.001;
const COST_IMAGE_GEN = 0.04;

const emptyDaily: DailyMetrics = {
  newUsers: 0,
  funnelStarted: 0,
  funnelModelUploaded: 0,
  funnelOutfitUploaded: 0,
  funnelGenerationRequested: 0,
  funnelCompleted: 0,
  totalGenerations: 0,
  successfulGenerations: 0,
  failedGenerations: 0,
  modelValidationAttempts: 0,
  modelValidationSuccess: 0,
  totalCost: 0,
  errorCounts: {}
};

export const initialMetrics: AnalyticsMetrics = {
  totalUsers: 0,
  activeUsersToday: 0,
  newUsersToday: 0,
  funnelStarted: 0,
  funnelModelUploaded: 0,
  funnelOutfitUploaded: 0,
  funnelGenerationRequested: 0,
  funnelCompleted: 0,
  totalGenerations: 0,
  successfulGenerations: 0,
  failedGenerations: 0,
  modelValidationAttempts: 0,
  modelValidationSuccess: 0,
  totalCost: 0,
  errorCounts: {},
  lastUpdated: Date.now(),
  history: {}
};

class AnalyticsService {
  private metrics: AnalyticsMetrics;
  private userProfiles: Record<string, UserAnalyticsProfile>;

  constructor() {
    this.metrics = this.loadMetrics();
    this.userProfiles = this.loadUserProfiles();
  }

  private loadMetrics(): AnalyticsMetrics {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure structure matches new interface
        return { 
          ...initialMetrics, 
          ...parsed, 
          history: parsed.history || {} 
        };
      }
      return initialMetrics;
    } catch (e) {
      return initialMetrics;
    }
  }

  private loadUserProfiles(): Record<string, UserAnalyticsProfile> {
    try {
      const stored = localStorage.getItem(PROFILES_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  }

  private saveMetrics() {
    this.metrics.lastUpdated = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.metrics));
  }

  private saveUserProfiles() {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(this.userProfiles));
  }

  private getTodayKey(): string {
    return new Date().toISOString().split('T')[0];
  }

  private ensureTodayHistory() {
    const today = this.getTodayKey();
    if (!this.metrics.history[today]) {
      this.metrics.history[today] = JSON.parse(JSON.stringify(emptyDaily));
    }
    return today;
  }

  // --- Public Getters with Filter ---

  public getMetrics(filter: DateRangeFilter = 'all'): AnalyticsMetrics {
    // 1. Calculate Active Users based on unique IDs for the range
    const activeUsersInRange = this.getActiveUsersForRange(filter);

    if (filter === 'all') {
      return { 
        ...this.metrics,
        activeUsersToday: activeUsersInRange 
      };
    }

    // 2. Aggregate history for the range
    const aggregated = JSON.parse(JSON.stringify(initialMetrics));
    aggregated.totalUsers = this.metrics.totalUsers; // Total users is always all-time count
    aggregated.activeUsersToday = activeUsersInRange; // This represents active users in the selected period

    const dates = this.getDatesForFilter(filter);
    
    dates.forEach(date => {
      const dayData = this.metrics.history[date];
      if (dayData) {
        aggregated.newUsersToday += dayData.newUsers;
        aggregated.funnelStarted += dayData.funnelStarted;
        aggregated.funnelModelUploaded += dayData.funnelModelUploaded;
        aggregated.funnelOutfitUploaded += dayData.funnelOutfitUploaded;
        aggregated.funnelGenerationRequested += dayData.funnelGenerationRequested;
        aggregated.funnelCompleted += dayData.funnelCompleted;
        aggregated.totalGenerations += dayData.totalGenerations;
        aggregated.successfulGenerations += dayData.successfulGenerations;
        aggregated.failedGenerations += dayData.failedGenerations;
        aggregated.modelValidationAttempts += dayData.modelValidationAttempts;
        aggregated.modelValidationSuccess += dayData.modelValidationSuccess;
        aggregated.totalCost += dayData.totalCost;

        // Merge Error Counts
        Object.entries(dayData.errorCounts).forEach(([err, count]) => {
          if (!aggregated.errorCounts[err]) aggregated.errorCounts[err] = 0;
          aggregated.errorCounts[err] += count;
        });
      }
    });

    return aggregated;
  }

  public getUserProfiles(): UserAnalyticsProfile[] {
    return Object.values(this.userProfiles).sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  }

  // --- Tracking Methods ---

  public trackUserActivity(chatId: number, userInfo?: { username?: string, firstName?: string }) {
    const userIdStr = chatId.toString();
    const now = Date.now();
    const today = this.ensureTodayHistory();

    // Update Profile
    if (!this.userProfiles[userIdStr]) {
      this.userProfiles[userIdStr] = {
        chatId,
        username: userInfo?.username || 'Unknown',
        firstName: userInfo?.firstName || 'User',
        joinedAt: now,
        lastActiveAt: now,
        generatedImagesCount: 0,
        purchasedCredits: 0,
        totalPaidAmount: 0,
        totalApiCost: 0
      };
      
      // Update Global
      this.metrics.newUsersToday++; 
      const allUsers = this.getStoredSet(USERS_KEY);
      allUsers.add(userIdStr);
      this.saveStoredSet(USERS_KEY, allUsers);
      this.metrics.totalUsers = allUsers.size;

      // Update Daily History
      this.metrics.history[today].newUsers++;
    } else {
      // Update existing info
      if (userInfo?.username) this.userProfiles[userIdStr].username = userInfo.username;
      if (userInfo?.firstName) this.userProfiles[userIdStr].firstName = userInfo.firstName;
      this.userProfiles[userIdStr].lastActiveAt = now;
    }
    this.saveUserProfiles();

    // Track DAU
    const dauKey = DAILY_ACTIVE_KEY + today;
    const dauSet = this.getStoredSet(dauKey);
    if (!dauSet.has(userIdStr)) {
      dauSet.add(userIdStr);
      this.saveStoredSet(dauKey, dauSet);
    }
    
    // For 'today' view in global metrics (keep sync)
    this.metrics.activeUsersToday = dauSet.size;
    this.saveMetrics();
  }

  public trackFunnelStep(step: 'start' | 'model' | 'outfit' | 'gen_req' | 'complete') {
    const today = this.ensureTodayHistory();

    // Update Global
    switch (step) {
      case 'start': this.metrics.funnelStarted++; break;
      case 'model': this.metrics.funnelModelUploaded++; break;
      case 'outfit': this.metrics.funnelOutfitUploaded++; break;
      case 'gen_req': this.metrics.funnelGenerationRequested++; break;
      case 'complete': this.metrics.funnelCompleted++; break;
    }

    // Update History
    switch (step) {
      case 'start': this.metrics.history[today].funnelStarted++; break;
      case 'model': this.metrics.history[today].funnelModelUploaded++; break;
      case 'outfit': this.metrics.history[today].funnelOutfitUploaded++; break;
      case 'gen_req': this.metrics.history[today].funnelGenerationRequested++; break;
      case 'complete': this.metrics.history[today].funnelCompleted++; break;
    }

    this.saveMetrics();
  }

  public trackModelValidation(userId: number, success: boolean) {
    const today = this.ensureTodayHistory();
    
    // Global
    this.metrics.modelValidationAttempts++;
    if (success) this.metrics.modelValidationSuccess++;
    this.metrics.totalCost += COST_VISION_INPUT;

    // History
    this.metrics.history[today].modelValidationAttempts++;
    if (success) this.metrics.history[today].modelValidationSuccess++;
    this.metrics.history[today].totalCost += COST_VISION_INPUT;
    
    // User Cost
    if (this.userProfiles[userId.toString()]) {
        this.userProfiles[userId.toString()].totalApiCost += COST_VISION_INPUT;
        this.saveUserProfiles();
    }
    
    this.saveMetrics();
  }

  public trackGeneration(userId: number, success: boolean) {
    const today = this.ensureTodayHistory();
    let cost = COST_GPT_INPUT; 
    
    // Global
    this.metrics.totalGenerations++;
    
    if (success) {
      this.metrics.successfulGenerations++;
      cost += COST_IMAGE_GEN;
    } else {
      this.metrics.failedGenerations++;
    }
    this.metrics.totalCost += cost;

    // History
    this.metrics.history[today].totalGenerations++;
    if (success) {
      this.metrics.history[today].successfulGenerations++;
    } else {
      this.metrics.history[today].failedGenerations++;
    }
    this.metrics.history[today].totalCost += cost;

    // User Profile Updates
    const pid = userId.toString();
    if (this.userProfiles[pid]) {
        if (success) this.userProfiles[pid].generatedImagesCount++;
        this.userProfiles[pid].totalApiCost += cost;
        this.saveUserProfiles();
    }

    this.saveMetrics();
  }

  public trackPayment(userId: number, amount: number, credits: number) {
      const pid = userId.toString();
      if (this.userProfiles[pid]) {
          this.userProfiles[pid].purchasedCredits += credits;
          this.userProfiles[pid].totalPaidAmount += amount;
          this.saveUserProfiles();
      }
  }

  public trackError(type: string) {
    const today = this.ensureTodayHistory();

    // Global
    if (!this.metrics.errorCounts[type]) this.metrics.errorCounts[type] = 0;
    this.metrics.errorCounts[type]++;

    // History
    if (!this.metrics.history[today].errorCounts[type]) this.metrics.history[today].errorCounts[type] = 0;
    this.metrics.history[today].errorCounts[type]++;

    this.saveMetrics();
  }
  
  // --- Helpers ---
  
  private getStoredSet(key: string): Set<string> {
    try {
      const item = localStorage.getItem(key);
      return item ? new Set(JSON.parse(item)) : new Set();
    } catch {
      return new Set();
    }
  }

  private saveStoredSet(key: string, set: Set<string>) {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  }

  private getDatesForFilter(filter: DateRangeFilter): string[] {
    const dates: string[] = [];
    const today = new Date();
    
    if (filter === 'today') {
        dates.push(today.toISOString().split('T')[0]);
        return dates;
    }
    
    if (filter === 'yesterday') {
        const d = new Date(today);
        d.setDate(d.getDate() - 1);
        dates.push(d.toISOString().split('T')[0]);
        return dates;
    }

    let daysBack = 0;
    if (filter === '7d') daysBack = 7;
    if (filter === '30d') daysBack = 30;
    if (filter === '90d') daysBack = 90;

    for (let i = 0; i < daysBack; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }

  private getActiveUsersForRange(filter: DateRangeFilter): number {
    if (filter === 'all') {
        // For 'all', we technically don't have a specific "active" count other than total users,
        // but typically 'Active Users' implies a time window. We will return 'Today's active for 'All' to match existing logic
        // OR we can return total users. Let's return Total Users from the set.
        return this.getStoredSet(USERS_KEY).size;
    }

    const dates = this.getDatesForFilter(filter);
    const uniqueUsers = new Set<string>();

    dates.forEach(date => {
        const key = DAILY_ACTIVE_KEY + date;
        const users = this.getStoredSet(key);
        users.forEach(u => uniqueUsers.add(u));
    });

    return uniqueUsers.size;
  }
}

export const analytics = new AnalyticsService();
