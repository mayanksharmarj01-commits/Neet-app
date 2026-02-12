'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CreateArenaForm() {
    const router = useRouter();

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        isPublic: true,
        maxParticipants: 50,
        scheduledStartTime: '',
        durationMinutes: 60,
        totalQuestions: 30,
        difficulty: '',
        subjectId: '',
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [roomCode, setRoomCode] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/arena/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...formData,
                    questionFilters: {
                        difficulty: formData.difficulty || undefined,
                        subjectId: formData.subjectId || undefined,
                    },
                }),
            });

            const data = await response.json();

            if (data.success) {
                setRoomCode(data.roomCode);
                // Redirect to arena page after showing room code
                setTimeout(() => {
                    router.push(`/arena/${data.arenaId}`);
                }, 3000);
            } else {
                setError(data.error || 'Failed to create arena');
            }
        } catch (err) {
            console.error('Error creating arena:', err);
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    // If room code is generated, show success modal
    if (roomCode) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Arena Created!</h2>
                    <p className="text-gray-600 mb-6">Share this code with participants</p>

                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl p-6 mb-6">
                        <div className="text-sm opacity-90 mb-2">Room Code</div>
                        <div className="text-4xl font-bold tracking-wider">{roomCode}</div>
                    </div>

                    <p className="text-sm text-gray-600 mb-4">Redirecting to arena...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Create New Arena</h2>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Title */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Arena Title *
                    </label>
                    <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="e.g., Physics Speed Battle"
                    />
                </div>

                {/* Description */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                    </label>
                    <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        rows={3}
                        placeholder="Describe your arena..."
                    />
                </div>

                {/* Visibility & Participants */}
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Visibility
                        </label>
                        <select
                            value={formData.isPublic ? 'public' : 'private'}
                            onChange={(e) => setFormData({ ...formData, isPublic: e.target.value === 'public' })}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="public">Public (anyone can join)</option>
                            <option value="private">Private (room code required)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Max Participants (up to 50)
                        </label>
                        <input
                            type="number"
                            min="2"
                            max="50"
                            value={formData.maxParticipants}
                            onChange={(e) => setFormData({ ...formData, maxParticipants: parseInt(e.target.value) })}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>

                {/* Schedule & Duration */}
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Scheduled Start Time *
                        </label>
                        <input
                            type="datetime-local"
                            required
                            value={formData.scheduledStartTime}
                            onChange={(e) => setFormData({ ...formData, scheduledStartTime: e.target.value })}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Duration (minutes)
                        </label>
                        <select
                            value={formData.durationMinutes}
                            onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) })}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="30">30 minutes</option>
                            <option value="60">60 minutes</option>
                            <option value="90">90 minutes</option>
                            <option value="120">120 minutes</option>
                        </select>
                    </div>
                </div>

                {/* Question Configuration */}
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Total Questions *
                        </label>
                        <input
                            type="number"
                            required
                            min="5"
                            max="100"
                            value={formData.totalQuestions}
                            onChange={(e) => setFormData({ ...formData, totalQuestions: parseInt(e.target.value) })}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Difficulty
                        </label>
                        <select
                            value={formData.difficulty}
                            onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">All Levels</option>
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                        </select>
                    </div>
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                        💡 <strong>Note:</strong> You can create up to 2 arenas per day. Arena rankings are separate from the national leaderboard.
                    </p>
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                    {loading ? (
                        <span className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Creating Arena...
                        </span>
                    ) : (
                        'Create Arena'
                    )}
                </button>
            </form>
        </div>
    );
}
