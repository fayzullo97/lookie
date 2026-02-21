import React from 'react';
import { SurveyResponse } from '../types';

interface SurveyDashboardProps {
    responses: SurveyResponse[];
}

const SurveyDashboard: React.FC<SurveyDashboardProps> = ({ responses }) => {
    return (
        <div className="p-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold text-white mb-8">User Surveys</h1>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-950/50 text-xs uppercase text-slate-500 font-medium tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 border-b border-slate-800">User</th>
                                    <th className="px-6 py-4 border-b border-slate-800">Date</th>
                                    <th className="px-6 py-4 border-b border-slate-800 text-center w-24">Q1: Satisfaction</th>
                                    <th className="px-6 py-4 border-b border-slate-800 text-center w-24">Q2: Realism</th>
                                    <th className="px-6 py-4 border-b border-slate-800">Q3: Frustration</th>
                                    <th className="px-6 py-4 border-b border-slate-800 text-center w-24">Q4: Value</th>
                                    <th className="px-6 py-4 border-b border-slate-800">Q5: Payment</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {responses.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                            No survey responses yet. Wait for users to run out of credits and complete the survey!
                                        </td>
                                    </tr>
                                ) : (
                                    responses.map((res) => (
                                        <tr key={res.id} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-medium text-white">{res.username ? `@${res.username}` : 'Unknown'}</div>
                                                <div className="text-xs text-slate-500">ID: {res.user_id}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400">
                                                {new Date(res.created_at).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span className={`inline-flex min-w-[30px] justify-center items-center px-2 py-1 rounded-md text-xs font-bold \${
                          res.q1_satisfaction >= 4 ? 'bg-emerald-500/10 text-emerald-400' :
                          res.q1_satisfaction === 3 ? 'bg-amber-500/10 text-amber-400' :
                          'bg-rose-500/10 text-rose-400'
                        }`}>
                                                    {res.q1_satisfaction}/5
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span className={`inline-flex min-w-[30px] justify-center items-center px-2 py-1 rounded-md text-xs font-bold \${
                          res.q2_realism >= 4 ? 'bg-emerald-500/10 text-emerald-400' :
                          res.q2_realism === 3 ? 'bg-amber-500/10 text-amber-400' :
                          'bg-rose-500/10 text-rose-400'
                        }`}>
                                                    {res.q2_realism}/5
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-medium">{res.q3_frustration}</span>
                                                {res.q3_frustration_other && (
                                                    <div className="text-xs text-slate-400 mt-1 italic whitespace-pre-wrap">"{res.q3_frustration_other}"</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span className={`inline-flex min-w-[30px] justify-center items-center px-2 py-1 rounded-md text-xs font-bold \${
                          res.q4_value >= 4 ? 'bg-emerald-500/10 text-emerald-400' :
                          res.q4_value === 3 ? 'bg-amber-500/10 text-amber-400' :
                          'bg-rose-500/10 text-rose-400'
                        }`}>
                                                    {res.q4_value}/5
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm whitespace-pre-wrap max-w-xs">{res.q5_payment}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SurveyDashboard;
