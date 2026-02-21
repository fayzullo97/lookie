import React, { useState, useEffect } from 'react';
import {
  AnalyticsMetrics,
  DateRangeFilter,
  UserAnalyticsProfile,
  SurveyResponse
} from './types';
import { analytics } from './services/analyticsService';
import Dashboard from './components/Dashboard';
import SurveyDashboard from './components/SurveyDashboard';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'settings' | 'survey'>('home');
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>('all');
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [profiles, setProfiles] = useState<UserAnalyticsProfile[]>([]);
  const [surveyResponses, setSurveyResponses] = useState<SurveyResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Poll for metrics and profiles
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [m, p, s] = await Promise.all([
          analytics.getMetrics(dateFilter),
          analytics.getUserProfiles(),
          analytics.getSurveyResponses()
        ]);
        setMetrics(m);
        setProfiles(p);
        setSurveyResponses(s);
      } catch (e) {
        console.error("Fetch error", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000); // Refreshes every 10s
    return () => clearInterval(interval);
  }, [dateFilter]);

  const handleGiftCredits = async (chatId: number, amount: number) => {
    try {
      await analytics.giftCredits(chatId, amount);
      // Refresh profiles after gifting
      const p = await analytics.getUserProfiles();
      setProfiles(p);
    } catch (e) {
      alert("Failed to gift credits. Is the bot server running?");
    }
  };

  if (isLoading && !metrics) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-banana-400"></div>
        <span className="ml-4">Loading Dashboard...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-900 text-slate-200 font-inter">
      {/* Sidebar */}
      <nav className="w-20 lg:w-64 border-r border-slate-800 flex flex-col items-center lg:items-stretch bg-slate-950/50 backdrop-blur-xl">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-banana-400 rounded-xl flex items-center justify-center shadow-lg shadow-banana-500/20">
            <span className="text-2xl">🍌</span>
          </div>
          <span className="hidden lg:block font-bold text-xl tracking-tight text-white">Lookie Admin</span>
        </div>

        <div className="flex-1 px-3 space-y-2 mt-4">
          <button
            onClick={() => setActiveTab('home')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'home'
              ? 'bg-banana-400/10 text-banana-400 shadow-sm'
              : 'hover:bg-slate-800/50 text-slate-400 hover:text-slate-200'
              }`}
          >
            <span className="text-xl">📊</span>
            <span className="hidden lg:block font-medium">Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'settings'
              ? 'bg-banana-400/10 text-banana-400 shadow-sm'
              : 'hover:bg-slate-800/50 text-slate-400 hover:text-slate-200'
              }`}
          >
            <span className="text-xl">⚙️</span>
            <span className="hidden lg:block font-medium">Settings</span>
          </button>

          <button
            onClick={() => setActiveTab('survey')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'survey'
              ? 'bg-banana-400/10 text-banana-400 shadow-sm'
              : 'hover:bg-slate-800/50 text-slate-400 hover:text-slate-200'
              }`}
          >
            <span className="text-xl">📝</span>
            <span className="hidden lg:block font-medium">Survey</span>
          </button>
        </div>

        <div className="p-4 border-t border-slate-800">
          <div className="hidden lg:block p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-500">Bot Status</span>
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Online
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
        <div className="min-h-full">
          {activeTab === 'home' && metrics && (
            <Dashboard
              metrics={metrics}
              userProfiles={profiles}
              dateFilter={dateFilter}
              onFilterChange={setDateFilter}
              onGiftCredits={handleGiftCredits}
            />
          )}

          {activeTab === 'survey' && (
            <SurveyDashboard
              responses={surveyResponses}
            />
          )}

          {activeTab === 'settings' && (
            <div className="p-8">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-3 mb-8">
                  <h1 className="text-3xl font-bold text-white">System Settings</h1>
                  <span className="px-2 py-1 bg-slate-800 rounded text-[10px] text-slate-400 font-mono">STANDALONE MODE</span>
                </div>
                <div className="bg-slate-950/50 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm">
                  <p className="text-slate-400 mb-6">
                    System settings (API Keys, Mock Mode, etc.) are now managed in the <code>.env</code> file of your <code>bot-server</code>.
                    Changes made here in the browser will not affect the running bot.
                  </p>
                  <div className="flex items-center gap-2 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400 text-sm">
                    <span>ℹ️</span>
                    <span>To update keys, please edit the <code>bot-server/.env</code> file and restart the bot server.</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
