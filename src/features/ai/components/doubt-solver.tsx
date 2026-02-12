'use client';

import { useState } from 'react';
import { AITokenUsage } from './ai-token-usage';

export function DoubtSolver() {
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [tokensUsed, setTokensUsed] = useState(0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!question.trim()) {
            setError('Please enter a question');
            return;
        }

        setLoading(true);
        setError('');
        setAnswer('');

        try {
            const response = await fetch('/api/ai/doubt-solver', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question,
                    context: {
                        subject: 'General',
                    },
                }),
            });

            const data = await response.json();

            if (response.status === 429) {
                // Rate limited or quota exceeded
                setError(data.error || 'You have reached your usage limit');
            } else if (!response.ok) {
                setError(data.error || 'Failed to get answer');
            } else {
                setAnswer(data.answer);
                setTokensUsed(data.tokensUsed);
            }
        } catch (err) {
            console.error('Error:', err);
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            {/* Token Usage Widget */}
            <div className="mb-8">
                <AITokenUsage />
            </div>

            {/* Doubt Solver Form */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
                <div className="mb-6">
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        AI Doubt Solver
                    </h2>
                    <p className="text-gray-600 mt-2">
                        Ask any question and get instant, detailed explanations
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Question Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Your Question
                        </label>
                        <textarea
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                            rows={4}
                            placeholder="e.g., Explain the concept of photosynthesis..."
                            maxLength={5000}
                        />
                        <div className="text-xs text-gray-500 mt-1">
                            {question.length}/5000 characters
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading || !question.trim()}
                        className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Getting Answer...
                            </span>
                        ) : (
                            '🤖 Get AI Answer'
                        )}
                    </button>
                </form>

                {/* Answer Display */}
                {answer && (
                    <div className="mt-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-indigo-100">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900">Answer</h3>
                            <span className="text-xs bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full font-semibold">
                                {tokensUsed} tokens used
                            </span>
                        </div>
                        <div className="prose prose-indigo max-w-none">
                            <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                                {answer}
                            </p>
                        </div>
                    </div>
                )}

                {/* Info Box */}
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                        💡 <strong>Tip:</strong> Be specific with your questions for better answers.
                        AI responses count towards your daily token limit.
                    </p>
                </div>
            </div>
        </div>
    );
}
