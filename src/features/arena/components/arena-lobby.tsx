'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getArenaRealtimeService } from '@/features/arena/services/arena-realtime.service';

export function ArenaLobby() {
    const router = useRouter();

    const [arenas, setArenas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [joinCode, setJoinCode] = useState('');
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchArenas();

        // Subscribe to real-time updates
        const realtimeService = getArenaRealtimeService();
        realtimeService.subscribeToArenaList({
            onArenaCreated: (arena) => {
                setArenas(prev => [arena, ...prev]);
            },
            onArenaUpdated: (arena) => {
                setArenas(prev => prev.map(a => a.id === arena.id ? arena : a));
            },
            onArenaDeleted: (arenaId) => {
                setArenas(prev => prev.filter(a => a.id !== arenaId));
            },
        });

        return () => {
            realtimeService.unsubscribeAll();
        };
    }, []);

    const fetchArenas = async () => {
        try {
            const response = await fetch('/api/arena/list?status=scheduled,live');
            const data = await response.json();

            if (data.success) {
                setArenas(data.arenas);
            }
        } catch (err) {
            console.error('Error fetching arenas:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleJoinByCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setJoining(true);
        setError('');

        try {
            const response = await fetch('/api/arena/join', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ roomCode: joinCode }),
            });

            const data = await response.json();

            if (data.success) {
                router.push(`/arena/${data.arenaId}`);
            } else {
                setError(data.error || 'Failed to join arena');
            }
        } catch (err) {
            console.error('Error joining arena:', err);
            setError('An unexpected error occurred');
        } finally {
            setJoining(false);
        }
    };

    const handleJoinArena = async (arenaId: string) => {
        router.push(`/arena/${arenaId}`);
    };

    const formatDateTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getStatusBadge = (status: string) => {
        const badges = {
            scheduled: 'bg-blue-100 text-blue-800',
            live: 'bg-green-100 text-green-800 animate-pulse',
            completed: 'bg-gray-100 text-gray-800',
        };
        return badges[status as keyof typeof badges] || badges.scheduled;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
                        Arena Lobby
                    </h1>
                    <p className="text-lg text-gray-600">Join live competitive battles or create your own</p>
                </div>

                {/* Join by Code */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Join with Code</h2>
                    <form onSubmit={handleJoinByCode} className="flex gap-4">
                        <input
                            type="text"
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            placeholder="Enter 6-digit room code"
                            maxLength={6}
                            className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent uppercase tracking-wider text-center text-2xl font-bold"
                        />
                        <button
                            type="submit"
                            disabled={joining || joinCode.length !== 6}
                            className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                        >
                            {joining ? 'Joining...' : 'Join'}
                        </button>
                    </form>
                    {error && (
                        <p className="mt-3 text-sm text-red-600">{error}</p>
                    )}
                </div>

                {/* Create Arena Button */}
                <div className="mb-8 text-center">
                    <button
                        onClick={() => router.push('/arena/create')}
                        className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
                    >
                        + Create New Arena
                    </button>
                </div>

                {/* Arena List */}
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Available Arenas</h2>

                    {loading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                            <p className="mt-4 text-gray-600">Loading arenas...</p>
                        </div>
                    ) : arenas.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl shadow-lg">
                            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            <p className="text-gray-600 mb-4">No active arenas right now</p>
                            <button
                                onClick={() => router.push('/arena/create')}
                                className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700"
                            >
                                Create the First Arena
                            </button>
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {arenas.map((arena) => (
                                <div
                                    key={arena.id}
                                    className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all"
                                >
                                    {/* Status Badge */}
                                    <div className="flex items-center justify-between mb-3">
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${getStatusBadge(arena.status)}`}>
                                            {arena.status === 'live' && '🔴 '}{arena.status}
                                        </span>
                                        {!arena.is_public && (
                                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-semibold">
                                                🔒 Private
                                            </span>
                                        )}
                                    </div>

                                    {/* Title */}
                                    <h3 className="text-lg font-bold text-gray-900 mb-2">{arena.title}</h3>

                                    {/* Description */}
                                    {arena.description && (
                                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{arena.description}</p>
                                    )}

                                    {/* Info */}
                                    <div className="space-y-2 mb-4 text-sm text-gray-700">
                                        <div className="flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span>{formatDateTime(arena.scheduled_start_time)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                            </svg>
                                            <span>{arena.participant_count}/{arena.max_participants}參與者</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <span>{arena.total_questions} Questions • {arena.duration_minutes} mins</span>
                                        </div>
                                    </div>

                                    {/* Join Button */}
                                    <button
                                        onClick={() => handleJoinArena(arena.id)}
                                        disabled={arena.participant_count >= arena.max_participants}
                                        className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                    >
                                        {arena.participant_count >= arena.max_participants ? 'Full' : 'Join Arena'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
