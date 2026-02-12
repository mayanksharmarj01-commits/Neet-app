'use client';

import { useState, useEffect } from 'react';

export function AITokenUsage() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
        // Refresh every 30 seconds
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchStats = async () => {
        try {
            const response = await fetch('/api/ai/usage');
            const data = await response.json();

            if (data.success) {
                setStats(data.stats);
            }
        } catch (error) {
            console.error('Error fetching AI usage:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="animate-pulse bg-gray-200 rounded-lg p-4 h-24"></div>
        );
    }

    if (!stats) return null;

    const usagePercentage = (stats.tokensUsedToday / stats.dailyLimit) * 100;
    const isNearLimit = usagePercentage > 80;

    return (
        <div className={`rounded-xl p-6 ${isNearLimit ? 'bg-red-50 border-2 border-red-200' : 'bg-gradient-to-r from-blue-50 to-indigo-50'
            }`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">AI Token Usage</h3>
                <div className="text-sm text-gray-600">
                    {stats.requestsToday} requests today
                </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-gray-700">
                        {stats.tokensUsedToday.toLocaleString()} / {stats.dailyLimit.toLocaleString()} tokens
                    </span>
                    <span className={`font-semibold ${isNearLimit ? 'text-red-600' : 'text-indigo-600'}`}>
                        {usagePercentage.toFixed(1)}%
                    </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${isNearLimit
                                ? 'bg-gradient-to-r from-red-500 to-red-600'
                                : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                            }`}
                        style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                    ></div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <div className="text-gray-600 mb-1">Remaining Today</div>
                    <div className="text-xl font-bold text-gray-900">
                        {stats.tokensRemainingToday.toLocaleString()}
                    </div>
                </div>
                <div>
                    <div className="text-gray-600 mb-1">Estimated Cost</div>
                    <div className="text-xl font-bold text-gray-900">
                        ${stats.estimatedCostToday.toFixed(4)}
                    </div>
                </div>
            </div>

            {/* Warning */}
            {isNearLimit && (
                <div className="mt-4 p-3 bg-red-100 rounded-lg">
                    <p className="text-sm text-red-800 font-medium">
                        ⚠️ You're approaching your daily AI usage limit!
                    </p>
                </div>
            )}

            {/* Reset Info */}
            <div className="mt-4 text-xs text-gray-600 text-center">
                Usage resets daily at midnight IST
            </div>
        </div>
    );
}
