
import React from 'react';

interface PromoData {
    codes: {
        code: string;
        userId: number;
        username: string;
        firstName: string;
        createdAt: string;
        redemptionCount: number;
    }[];
    redemptions: {
        code: string;
        redeemedBy: number;
        redeemerName: string;
        redeemerUsername: string;
        ownerId: number;
        ownerName: string;
        ownerUsername: string;
        createdAt: string;
    }[];
}

interface PromoDashboardProps {
    promoData: PromoData;
}

const PromoDashboard: React.FC<PromoDashboardProps> = ({ promoData }) => {
    const totalCodes = promoData.codes.length;
    const totalRedemptions = promoData.redemptions.length;
    const totalCreditsGiven = totalRedemptions * 40; // 20 each side

    return (
        <div className="p-8 space-y-6">
            <h1 className="text-3xl font-bold text-white">PromoCode Analytics</h1>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
                    <div className="text-slate-400 text-xs font-bold uppercase mb-1">Total Promo Codes</div>
                    <div className="text-3xl font-bold text-white">{totalCodes}</div>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
                    <div className="text-slate-400 text-xs font-bold uppercase mb-1">Total Redemptions</div>
                    <div className="text-3xl font-bold text-indigo-400">{totalRedemptions}</div>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
                    <div className="text-slate-400 text-xs font-bold uppercase mb-1">Credits Given (Both Sides)</div>
                    <div className="text-3xl font-bold text-green-400">{totalCreditsGiven}</div>
                </div>
            </div>

            {/* Promo Codes Table */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
                <div className="p-4 border-b border-slate-700">
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Promo Codes by User</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="text-slate-400 bg-slate-900/50 font-bold uppercase">
                            <tr>
                                <th className="px-4 py-3">Code</th>
                                <th className="px-4 py-3">Owner</th>
                                <th className="px-4 py-3 text-right">Times Used</th>
                                <th className="px-4 py-3 text-right">Created</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {promoData.codes.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500 italic">No promo codes yet.</td>
                                </tr>
                            ) : (
                                promoData.codes.map(code => (
                                    <tr key={code.code} className="hover:bg-slate-700/50 transition-colors">
                                        <td className="px-4 py-3 font-mono text-indigo-400 font-bold">{code.code}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-white">{code.firstName}</div>
                                            <div className="text-slate-500">@{code.username}</div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`font-bold ${code.redemptionCount > 0 ? 'text-green-400' : 'text-slate-500'}`}>
                                                {code.redemptionCount}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-400">
                                            {new Date(code.createdAt).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Redemptions Table */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
                <div className="p-4 border-b border-slate-700">
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Redemption History</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="text-slate-400 bg-slate-900/50 font-bold uppercase">
                            <tr>
                                <th className="px-4 py-3">Code</th>
                                <th className="px-4 py-3">Code Owner</th>
                                <th className="px-4 py-3">Used By</th>
                                <th className="px-4 py-3 text-right">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {promoData.redemptions.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500 italic">No redemptions yet.</td>
                                </tr>
                            ) : (
                                promoData.redemptions.map((r, i) => (
                                    <tr key={i} className="hover:bg-slate-700/50 transition-colors">
                                        <td className="px-4 py-3 font-mono text-indigo-400 font-bold">{r.code}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-white">{r.ownerName}</div>
                                            <div className="text-slate-500">@{r.ownerUsername}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-green-400">{r.redeemerName}</div>
                                            <div className="text-slate-500">@{r.redeemerUsername}</div>
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-400">
                                            {new Date(r.createdAt).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PromoDashboard;
