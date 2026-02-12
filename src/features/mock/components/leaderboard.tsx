'use client';

import { useState, useEffect } from 'react';
import { LeaderboardEntry } from '@/features/mock/services/mock-test.service';

export function Leaderboard() {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [myRank, setMyRank] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [cacheAge, setCacheAge] = useState<number | null>(null);

    useEffect(() => {
        fetchLeaderboard();
        fetchMyRank();

        // Auto-refresh every 5 minutes
        const interval = setInterval(() => {
            fetchLeaderboard();
            fetchMyRank();
        }, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, []);

    const fetchLeaderboard = async () => {
        try {
            const response = await fetch('/api/leaderboard?limit=100');
            const data = await response.json();

            if (data.success) {
                setLeaderboard(data.leaderboard);
                setCacheAge(data.cacheAge);
            }
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMyRank = async () => {
        try {
            const response = await fetch('/api/leaderboard/my-rank');
            const data = await response.json();

            if (data.success) {
                setMyRank(data.rank);
            }
        } catch (error) {
            console.error('Error fetching rank:', error);
        }
    };

    const formatCacheAge = (seconds: number | null) => {
        if (seconds === null) return 'Unknown';
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m ago`;
    };

    const getMedalEmoji = (rank: number) => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return '';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 py-12 px-4">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
                        National Leaderboard
                    </h1>
                    <p className="text-gray-600">
                        Updated every 5 minutes • Last update: {formatCacheAge(cacheAge)}
                    </p>
                </div>

                {/* My Rank Card */}
                {myRank && (
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-2xl p-6 mb-8 text-white">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold mb-4">Your Rank</h2>
                            <div className="grid md:grid-cols-3 gap-6">
                                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                                    <div className="text-4xl font-bold mb-1">{getMedalEmoji(myRank.rank)} #{myRank.rank}</div>
                                    <div className="text-sm opacity-90">National Rank</div>
                                </div>
                                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                                    <div className="text-4xl font-bold mb-1">{myRank.percentile.toFixed(2)}%</div>
                                    <div className="text-sm opacity-90">Percentile</div>
                                </div>
                                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                                    <div className="text-4xl font-bold mb-1">{myRank.totalScore.toFixed(0)}</div>
                                    <div className="text-sm opacity-90">Total Score</div>
                                </div>
                            </div>
                            <div className="mt-4 flex justify-center gap-8 text-sm">
                                <div>
                                    <span className="opacity-75">Mock: </span>
                                    <span className="font-bold">{myRank.mockScore.toFixed(0)} (70%)</span>
                                </div>
                                <div>
                                    <span className="opacity-75">Practice: </span>
                                    <span className="font-bold">{myRank.practiceScore.toFixed(0)} (30%)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Leaderboard Table */}
                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                    <div className="p-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                        <h2 className="text-2xl font-bold">Top 100 Students</h2>
                    </div>

                    {loading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                            <p className="mt-4 text-gray-600">Loading leaderboard...</p>
                        </div>
                    ) : leaderboard.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-600">No rankings available yet</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b-2 border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                            Rank
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                            Name
                                        </th>
                                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                            Percentile
                                        </th>
                                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                            Total Score
                                        </th>
                                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                            Mocks
                                        </th>
                                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                            Accuracy
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {leaderboard.map((entry, index) => (
                                        <tr
                                            key={entry.userId}
                                            className={`hover:bg-gray-50 transition-colors ${entry.rank <= 3 ? 'bg-yellow-50' : ''
                                                }`}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-2xl">{getMedalEmoji(entry.rank)}</span>
                                                    <span className="font-bold text-lg text-gray-900">
                                                        #{entry.rank}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">{entry.userName}</div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-semibold">
                                                    {entry.percentile.toFixed(2)}%
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="font-bold text-lg text-indigo-600">
                                                    {entry.totalScore.toFixed(0)}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    M: {entry.mockScore.toFixed(0)} | P: {entry.practiceScore.toFixed(0)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-gray-900 font-medium">
                                                    {entry.mocksCompleted}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${entry.accuracy >= 80 ? 'bg-green-100 text-green-800' :
                                                        entry.accuracy >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                                            'bg-red-100 text-red-800'
                                                    }`}>
                                                    {entry.accuracy.toFixed(1)}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Info Card */}
                <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
                    <h3 className="font-bold text-lg mb-4">How Rankings Work</h3>
                    <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-700">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                                70%
                            </div>
                            <div>
                                <div className="font-semibold">Mock Tests</div>
                                <div className="text-gray-600">Your score from completed mock tests contributes 70% to your rank</div>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                                30%
                            </div>
                            <div>
                                <div className="font-semibold">Daily Practice</div>
                                <div className="text-gray-600">Your daily practice score contributes 30% to your rank</div>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800">
                            💡 <strong>Tip:</strong> Rankings are based on your performance over the last 30 days and are updated every 5 minutes.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
