'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MockTest } from '@/features/mock/services/mock-test.service';

export function MockTestSelector() {
    const router = useRouter();

    const [mocks, setMocks] = useState<MockTest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({
        mockType: '',
        difficulty: '',
    });
    const [startingMock, setStartingMock] = useState<string | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchMocks();
    }, [filter]);

    const fetchMocks = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filter.mockType) params.append('mockType', filter.mockType);
            if (filter.difficulty) params.append('difficulty', filter.difficulty);

            const response = await fetch(`/api/mock/list?${params}`);
            const data = await response.json();

            if (data.success) {
                setMocks(data.mocks);
            }
        } catch (err) {
            console.error('Error fetching mocks:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleStartMock = async (mockId: string) => {
        setStartingMock(mockId);
        setError('');

        try {
            const response = await fetch('/api/mock/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ mockTestId: mockId }),
            });

            const data = await response.json();

            if (data.success) {
                router.push(`/test/${data.sessionId}`);
            } else {
                setError(data.error || 'Failed to start mock test');
                setStartingMock(null);
            }
        } catch (err) {
            console.error('Error starting mock:', err);
            setError('An unexpected error occurred');
            setStartingMock(null);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">Mock Tests</h1>
                    <p className="text-lg text-gray-600">Test your knowledge with comprehensive mock tests</p>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Test Type
                            </label>
                            <select
                                value={filter.mockType}
                                onChange={(e) => setFilter({ ...filter, mockType: e.target.value })}
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            >
                                <option value="">All Types</option>
                                <option value="subject">Subject-wise</option>
                                <option value="chapter">Chapter-wise</option>
                                <option value="full_syllabus">Full Syllabus</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Difficulty
                            </label>
                            <select
                                value={filter.difficulty}
                                onChange={(e) => setFilter({ ...filter, difficulty: e.target.value })}
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            >
                                <option value="">All Levels</option>
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                                <option value="mixed">Mixed</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800">{error}</p>
                    </div>
                )}

                {/* Mock Tests Grid */}
                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Loading mock tests...</p>
                    </div>
                ) : mocks.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl shadow-lg">
                        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-gray-600">No mock tests found</p>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {mocks.map((mock) => (
                            <div
                                key={mock.id}
                                className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all"
                            >
                                {/* Premium Badge */}
                                {mock.isPremium && (
                                    <span className="inline-block px-3 py-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold rounded-full mb-3">
                                        ⭐ PREMIUM
                                    </span>
                                )}

                                {/* Mock Title */}
                                <h3 className="text-xl font-bold text-gray-900 mb-2">{mock.title}</h3>

                                {/* Description */}
                                {mock.description && (
                                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{mock.description}</p>
                                )}

                                {/* Meta Info */}
                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded capitalize">
                                            {mock.mockType.replace('_', ' ')}
                                        </span>
                                        <span className={`px-2 py-1 rounded capitalize ${mock.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                                                mock.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                                    mock.difficulty === 'hard' ? 'bg-red-100 text-red-800' :
                                                        'bg-purple-100 text-purple-800'
                                            }`}>
                                            {mock.difficulty}
                                        </span>
                                    </div>

                                    <div className="flex justify-between text-sm text-gray-600">
                                        <span>📝 {mock.totalQuestions} Questions</span>
                                        <span>⏱️ {mock.durationMinutes} mins</span>
                                    </div>

                                    <div className="text-sm font-semibold text-indigo-600">
                                        Total Marks: {mock.totalMarks}
                                    </div>
                                </div>

                                {/* Start Button */}
                                <button
                                    onClick={() => handleStartMock(mock.id)}
                                    disabled={startingMock === mock.id}
                                    className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                >
                                    {startingMock === mock.id ? (
                                        <span className="flex items-center justify-center">
                                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Starting...
                                        </span>
                                    ) : (
                                        'Start Mock Test'
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
