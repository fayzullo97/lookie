

import React, { useState } from 'react';
import { AnalyticsMetrics, DateRangeFilter } from '../types';
import { analytics } from '../services/analyticsService';

interface DashboardProps {
  metrics: AnalyticsMetrics;
  dateFilter: DateRangeFilter;
  setDateFilter: (filter: DateRangeFilter) => void;
  onGiftCredits: (chatId: number, amount: number) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ metrics, dateFilter, setDateFilter, onGiftCredits }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [giftModalUser, setGiftModalUser] = useState<{ id: number, name: string } | null>(null);
  const [giftAmount, setGiftAmount] = useState<string>('10');

  const userProfiles = analytics.getUserProfiles();

  // Derived Metrics
  const successRate = metrics.totalGenerations > 0
    ? ((metrics.successfulGenerations / metrics.totalGenerations) * 100).toFixed(1)
    : '0.0';

  const modelUploadRate = metrics.modelValidationAttempts > 0
    ? ((metrics.modelValidationSuccess / metrics.modelValidationAttempts) * 100).toFixed(1)
    : '0.0';

  const costPerGen = metrics.totalGenerations > 0
    ? (metrics.totalCost / metrics.totalGenerations).toFixed(3)
    : '0.000';

  const handleGiftSubmit = () => {
    if (giftModalUser && giftAmount) {
      const amt = parseInt(giftAmount);
      if (!isNaN(amt) && amt !== 0) {
        onGiftCredits(giftModalUser.id, amt);
      }
    }
    setGiftModalUser(null);
    setGiftAmount('10');
  };

  return (
    <div className="space-y-6 relative">
      {/* FILTER CONTROLS */}
      <div className="flex justify-end absolute -top-14 right-0 md:static md:mb-6">
        <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-lg border border-slate-700 shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 ml-2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateRangeFilter)}
            className="bg-transparent text-white text-xs font-bold border-none focus:ring-0 cursor-pointer pr-8"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* HEADER / TOP KPIs (Tier 1) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
          <div className="text-slate-400 text-xs font-bold uppercase mb-1">Active Users</div>
          <div className="text-3xl font-bold text-white">{metrics.activeUsersToday}</div>
          <div className="text-xs text-green-400 mt-2 flex items-center">
            <span className="bg-green-500/10 px-1.5 py-0.5 rounded mr-2">LIVE</span>
            Total: {metrics.totalUsers}
          </div>
        </div>

        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
          <div className="text-slate-400 text-xs font-bold uppercase mb-1">Generations</div>
          <div className="text-3xl font-bold text-indigo-400">{metrics.totalGenerations}</div>
          <div className="text-xs text-slate-400 mt-2">
            {metrics.successfulGenerations} success / {metrics.failedGenerations} fail
          </div>
        </div>

        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
          <div className="text-slate-400 text-xs font-bold uppercase mb-1">Success Rate</div>
          <div className={`text-3xl font-bold ${Number(successRate) > 90 ? 'text-green-400' : 'text-yellow-400'}`}>
            {successRate}%
          </div>
          <div className="text-xs text-slate-400 mt-2">Target: &gt; 95%</div>
        </div>

        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
          <div className="text-slate-400 text-xs font-bold uppercase mb-1">Est. Cost (USD)</div>
          <div className="text-3xl font-bold text-white">${metrics.totalCost.toFixed(2)}</div>
          <div className="text-xs text-slate-400 mt-2">
            ${costPerGen} / gen
          </div>
        </div>
      </div>

      {/* FUNNEL VISUALIZATION */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
        <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">User Funnel (Session Flow)</h3>
        <div className="flex flex-col md:flex-row gap-2 items-center justify-between text-xs text-slate-400">
          {/* Step 1 */}
          <div className="flex-1 w-full bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 relative">
            <div className="font-bold text-white text-lg">{metrics.funnelStarted}</div>
            <div>Bot Started</div>
          </div>
          <div className="hidden md:block text-slate-600">→</div>

          {/* Step 2 */}
          <div className="flex-1 w-full bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
            <div className="font-bold text-white text-lg">{metrics.funnelModelUploaded}</div>
            <div>Model Uploaded</div>
            <div className="text-[10px] text-slate-500 mt-1">{modelUploadRate}% Valid</div>
          </div>
          <div className="hidden md:block text-slate-600">→</div>

          {/* Step 3 */}
          <div className="flex-1 w-full bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
            <div className="font-bold text-white text-lg">{metrics.funnelOutfitUploaded}</div>
            <div>Outfit Added</div>
          </div>
          <div className="hidden md:block text-slate-600">→</div>

          {/* Step 4 */}
          <div className="flex-1 w-full bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
            <div className="font-bold text-indigo-400 text-lg">{metrics.funnelGenerationRequested}</div>
            <div>Gen Requested</div>
          </div>
          <div className="hidden md:block text-slate-600">→</div>

          {/* Step 5 */}
          <div className="flex-1 w-full bg-slate-900/50 p-3 rounded-lg border border-green-500/20 bg-green-500/5">
            <div className="font-bold text-green-400 text-lg">{metrics.funnelCompleted}</div>
            <div>Completed</div>
          </div>
        </div>
      </div>

      {/* USER LIST TABLE */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">User List & Spend Metrics</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-slate-400 bg-slate-900/50 font-bold uppercase">
              <tr>
                <th className="px-4 py-3">Chat ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 text-right">Generated</th>
                <th className="px-4 py-3 text-right">Credits Bought</th>
                <th className="px-4 py-3 text-right">Total Paid (UZS)</th>
                <th className="px-4 py-3 text-right">Est. Cost (USD)</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {userProfiles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 italic">No users recorded yet.</td>
                </tr>
              ) : (
                userProfiles.map(user => {
                  // Format UZS
                  const paidFormatted = new Intl.NumberFormat('uz-UZ').format(user.totalPaidAmount);

                  return (
                    <tr key={user.chatId} className="hover:bg-slate-700/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-slate-400">{user.chatId}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-white">{user.firstName}</div>
                        <div className="text-slate-500">@{user.username}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-indigo-400">{user.generatedImagesCount}</td>
                      <td className="px-4 py-3 text-right text-white">{user.purchasedCredits}</td>
                      <td className="px-4 py-3 text-right text-green-400">{paidFormatted}</td>
                      <td className="px-4 py-3 text-right text-slate-300">${user.totalApiCost.toFixed(3)}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setGiftModalUser({ id: user.chatId, name: user.firstName || user.username })}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded text-[10px] font-bold transition-colors"
                          title="Give Free Credits"
                        >
                          Gift 🎁
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* GIFT MODAL */}
      {giftModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-2">🎁 Gift Credits</h3>
            <p className="text-slate-400 text-sm mb-4">
              Sending credits to <span className="text-indigo-400 font-bold">{giftModalUser.name}</span> ({giftModalUser.id})
            </p>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount</label>
              <input
                type="number"
                value={giftAmount}
                onChange={(e) => setGiftAmount(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
              <div className="flex gap-2 mt-2">
                {[10, 30, 50, 100].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setGiftAmount(amt.toString())}
                    className="bg-slate-700 hover:bg-slate-600 text-xs px-2 py-1 rounded text-slate-300"
                  >
                    +{amt}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setGiftModalUser(null)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGiftSubmit}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-sm transition-colors shadow-lg shadow-indigo-500/20"
              >
                Send Gift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADVANCED METRICS TOGGLE */}
      <div className="flex items-center gap-4 pt-4 border-t border-slate-700/50">
        <label className="flex items-center gap-2 cursor-pointer">
          <div className="relative">
            <input type="checkbox" className="sr-only" checked={showAdvanced} onChange={(e) => setShowAdvanced(e.target.checked)} />
            <div className={`w-10 h-5 rounded-full shadow-inner transition-colors ${showAdvanced ? 'bg-indigo-600' : 'bg-slate-700'}`}></div>
            <div className={`dot absolute w-3 h-3 bg-white rounded-full top-1 left-1 transition-transform ${showAdvanced ? 'transform translate-x-5' : ''}`}></div>
          </div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Show Advanced Metrics (Tier 2 & 3)</span>
        </label>
      </div>

      {/* ADVANCED METRICS (Tier 2/3) */}
      {showAdvanced && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in pb-10">
          {/* Errors */}
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Error Distribution</h4>
            {Object.keys(metrics.errorCounts).length === 0 ? (
              <div className="text-slate-600 text-sm italic">No errors recorded yet.</div>
            ) : (
              <div className="space-y-2">
                {Object.entries(metrics.errorCounts).map(([err, count]) => (
                  <div key={err} className="flex justify-between text-xs border-b border-slate-700 pb-1 last:border-0">
                    <span className="text-red-300 font-mono truncate pr-2">{err}</span>
                    <span className="text-white font-bold">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Business Health */}
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Health Check</h4>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Funnel Conversion (Start → Complete)</span>
                <span className="text-white font-bold">
                  {metrics.funnelStarted > 0 ? ((metrics.funnelCompleted / metrics.funnelStarted) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Validation Reject Rate</span>
                <span className="text-white font-bold">
                  {metrics.modelValidationAttempts > 0
                    ? (100 - (metrics.modelValidationSuccess / metrics.modelValidationAttempts * 100)).toFixed(1)
                    : '0.0'}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Avg Cost per User (Today)</span>
                <span className="text-white font-bold">
                  ${metrics.activeUsersToday > 0
                    ? (metrics.totalCost / metrics.activeUsersToday).toFixed(2)
                    : '0.00'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
