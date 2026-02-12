'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getArenaRealtimeService } from '@/features/arena/services/arena-realtime.service';
import { TestInterface } from '@/features/mock/components/test-interface';

export function ArenaRoom({ arenaId }: { arenaId: string }) {
    const router = useRouter();

    const [arena, setArena] = useState<any>(null);
    const [participants, setParticipants] = useState<any[]>([]);
    const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isHost, setIsHost] = useState(false);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [showLeaderboard, setShowLeaderboard] = useState(false);

    useEffect(() => {
        fetchArenaData();
        setupRealtimeSubscription();

        return () => {
            const realtimeService = getArenaRealtimeService();
            realtimeService.unsubscribeFromArena(arenaId);
        };
    }, [arenaId]);

    const fetchArenaData = async () => {
        try {
            // Fetch arena
            const arenaResponse = await fetch(`/api/arena/${arenaId}`);
            const arenaData = await arenaResponse.json();

            if (arenaData.success) {
                setArena(arenaData.arena);
            }

            // Fetch participants
            const participantsResponse = await fetch(`/api/arena/${arenaId}/participants`);
            const participantsData = await participantsResponse.json();

            if (participantsData.success) {
                setParticipants(participantsData.participants);
                const me = participantsData.participants.find((p: any) => p.is_current_user);
                if (me) {
                    setIsHost(me.is_host);
                    setHasSubmitted(!!me.submitted_at);
                }
            }
        } catch (error) {
            console.error('Error fetching arena data:', error);
        } finally {
            setLoading(false);
        }
    };

    const setupRealtimeSubscription = () => {
        const realtimeService = getArenaRealtimeService();

        realtimeService.subscribeToArena(arenaId, {
            onArenaUpdate: (updatedArena) => {
                setArena(updatedArena);
            },
            onParticipantJoin: (participant) => {
                setParticipants(prev => [...prev, participant]);
            },
            onParticipantUpdate: (participant) => {
                setParticipants(prev =>
                    prev.map(p => p.id === participant.id ? participant : p)
                );

                // Refresh leaderboard if showing
                if (showLeaderboard) {
                    fetchLeaderboard();
                }
            },
            onStatusChange: (status) => {
                console.log('Arena status changed:', status);
            },
        });

        // Setup presence
        realtimeService.onPresenceSync(arenaId, (state) => {
            const users = Object.values(state).flat();
            setOnlineUsers(users);
        });
    };

    const handleStartArena = async () => {
        try {
            const response = await fetch(`/api/arena/${arenaId}/start`, {
                method: 'POST',
            });

            const data = await response.json();
            if (data.success) {
                // Arena status will update via realtime
                console.log('Arena started!');
            }
        } catch (error) {
            console.error('Error starting arena:', error);
        }
    };

    const handleSubmit = async (answers: any, timeTaken: number) => {
        try {
            const response = await fetch(`/api/arena/${arenaId}/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    answers,
                    timeTakenSeconds: timeTaken,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setHasSubmitted(true);
                setShowLeaderboard(true);
                await fetchLeaderboard();
            }
        } catch (error) {
            console.error('Error submitting:', error);
        }
    };

    const fetchLeaderboard = async () => {
        try {
            const response = await fetch(`/api/arena/${arenaId}/leaderboard`);
            const data = await response.json();

            if (data.success) {
                setLeaderboard(data.leaderboard);
            }
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
        }
    };

    const handleViewSolutions = async () => {
        // Mark solutions as viewed
        await fetch(`/api/arena/${arenaId}/view-solutions`, {
            method: 'POST',
        });
        setShowLeaderboard(false);
        router.push(`/arena/${arenaId}/solutions`);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    // If arena is live and user hasn't submitted, show test interface
    if (arena?.status === 'live' && !hasSubmitted && arena?.questions?.length > 0) {
        return (
            <TestInterface
                sessionId={arenaId}
                initialQuestions={arena.questions}
                initialSession={{
                    answers: {},
                    markedForReview: [],
                    remainingTime: (arena.duration_minutes || 60) * 60, // Default 60 mins if missing
                    tabSwitchCount: 0
                }}
                onSubmit={handleSubmit}
            />
        );
    }

    // Waiting room / Results
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
            <div className="max-w-6xl mx-auto">
                {/* Arena Header */}
                <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">{arena?.title}</h1>
                            {arena?.description && (
                                <p className="text-gray-600 mt-2">{arena.description}</p>
                            )}
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-gray-600 mb-1">Room Code</div>
                            <div className="text-2xl font-bold text-indigo-600 tracking-wider">
                                {arena?.room_code}
                            </div>
                        </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-4">
                        <span className={`px-4 py-2 rounded-full text-sm font-semibold ${arena?.status === 'live' ? 'bg-green-100 text-green-800 animate-pulse' :
                            arena?.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                                'bg-blue-100 text-blue-800'
                            }`}>
                            {arena?.status === 'live' && '🔴 '}{arena?.status?.toUpperCase()}
                        </span>
                        <span className="text-gray-600">
                            {participants.length}/{arena?.max_participants} Participants
                        </span>
                        <span className="text-gray-600">
                            {onlineUsers.length} Online
                        </span>
                    </div>

                    {/* Host Controls */}
                    {isHost && arena?.status === 'scheduled' && (
                        <div className="mt-6">
                            <button
                                onClick={handleStartArena}
                                className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-lg hover:shadow-lg transition-all"
                            >
                                🚀 Start Arena Now
                            </button>
                        </div>
                    )}
                </div>

                {/* Participants List */}
                <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Participants</h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {participants.map((participant) => (
                            <div
                                key={participant.id}
                                className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg"
                            >
                                <div className={`w-3 h-3 rounded-full ${onlineUsers.some((u: any) => u.user_id === participant.user_id)
                                    ? 'bg-green-500'
                                    : 'bg-gray-300'
                                    }`}></div>
                                <div className="flex-1">
                                    <div className="font-medium text-gray-900">
                                        {participant.user_name || 'Anonymous'}
                                        {participant.is_host && (
                                            <span className="ml-2 text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded">
                                                HOST
                                            </span>
                                        )}
                                    </div>
                                    {participant.submitted_at && (
                                        <div className="text-xs text-green-600">✓ Submitted</div>
                                    )}
                                </div>
                                {participant.rank && (
                                    <div className="text-lg font-bold text-indigo-600">
                                        #{participant.rank}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Leaderboard (if submitted) */}
                {showLeaderboard && leaderboard.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-gray-900">Leaderboard</h2>
                            <button
                                onClick={handleViewSolutions}
                                className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700"
                            >
                                View Solutions
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b-2 border-gray-200">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                                            Rank
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                                            Name
                                        </th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                                            Score
                                        </th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                                            Time
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {leaderboard.map((entry: any, index: number) => (
                                        <tr key={entry.user_id} className={index < 3 ? 'bg-yellow-50' : ''}>
                                            <td className="px-6 py-4">
                                                <span className="text-2xl font-bold text-gray-900">
                                                    {entry.rank === 1 && '🥇'}
                                                    {entry.rank === 2 && '🥈'}
                                                    {entry.rank === 3 && '🥉'}
                                                    {entry.rank > 3 && `#${entry.rank}`}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                {entry.users?.full_name || entry.users?.email || 'Anonymous'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-lg font-bold text-indigo-600">
                                                    {entry.score}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center text-gray-600">
                                                {Math.floor(entry.time_taken_seconds / 60)}m {entry.time_taken_seconds % 60}s
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-sm text-yellow-800">
                                ⚠️ <strong>Note:</strong> Viewing solutions will hide this leaderboard permanently.
                            </p>
                        </div>
                    </div>
                )}

                {/* Waiting Message */}
                {arena?.status === 'scheduled' && !isHost && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
                        <svg className="w-16 h-16 text-blue-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Waiting for host to start...</h3>
                        <p className="text-gray-600">
                            Scheduled for: {new Date(arena.scheduled_start_time).toLocaleString()}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
