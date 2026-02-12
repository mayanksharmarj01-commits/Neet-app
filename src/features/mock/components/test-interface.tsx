'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { QuestionCard } from './question-card';
import { Question } from '../services/question-engine.service';

interface TestInterfaceProps {
    sessionId: string;
    initialQuestions: Question[];
    initialSession: any;
    onSubmit?: (answers: any, timeTaken: number) => Promise<void>;
}

export function TestInterface({ sessionId, initialQuestions, initialSession, onSubmit }: TestInterfaceProps) {
    const router = useRouter();

    const [questions, setQuestions] = useState<Question[]>(initialQuestions);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, any>>(initialSession.answers || {});
    const [markedForReview, setMarkedForReview] = useState<string[]>(initialSession.markedForReview || []);
    const [remainingTime, setRemainingTime] = useState(initialSession.remainingTime || 0);
    const [tabSwitchCount, setTabSwitchCount] = useState(initialSession.tabSwitchCount || 0);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const autoSaveTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const lastSavedAnswersRef = useRef<string>(JSON.stringify(answers));

    // Block copy-paste
    useEffect(() => {
        const handleCopyProperties = (e: any) => {
            e.preventDefault();
            return false;
        };

        document.addEventListener('copy', handleCopyProperties);
        document.addEventListener('paste', handleCopyProperties);
        document.addEventListener('contextmenu', handleCopyProperties);

        return () => {
            document.removeEventListener('copy', handleCopyProperties);
            document.removeEventListener('paste', handleCopyProperties);
            document.removeEventListener('contextmenu', handleCopyProperties);
        };
    }, []);

    // Detect tab switch
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.hidden) {
                // User switched tab
                setTabSwitchCount((prev: number) => prev + 1);

                if (!onSubmit) { // Only track tab switch API for mock tests
                    try {
                        await fetch(`/api/test/${sessionId}/tab-switch`, {
                            method: 'POST',
                        });
                    } catch (error) {
                        console.error('Error tracking tab switch:', error);
                    }
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [sessionId, onSubmit]);

    // Timer
    useEffect(() => {
        const timer = setInterval(() => {
            setRemainingTime((prev: number) => {
                if (prev <= 0) {
                    clearInterval(timer);
                    handleSubmit();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, []); // Empty dependency array to mount once

    // Auto-save
    useEffect(() => {
        // Skip auto-save if onSubmit is provided (Arena mode)
        if (onSubmit) return;

        if (JSON.stringify(answers) !== lastSavedAnswersRef.current) {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

            autoSaveTimerRef.current = setTimeout(async () => {
                try {
                    await fetch(`/api/test/${sessionId}/save`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            answers,
                            remainingTime,
                            markedForReview,
                            tabSwitchCount
                        }),
                    });
                    lastSavedAnswersRef.current = JSON.stringify(answers);
                } catch (error) {
                    console.error('Auto-save failed', error);
                }
            }, 5000);
        }

        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    }, [answers, remainingTime, markedForReview, tabSwitchCount, sessionId, onSubmit]);

    // Format time
    const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleAnswerChange = (answer: any) => {
        const currentQuestion = questions[currentIndex];
        setAnswers(prev => ({
            ...prev,
            [currentQuestion.id]: answer
        }));
    };

    const handleToggleReview = () => {
        const currentQuestion = questions[currentIndex];
        setMarkedForReview(prev => {
            if (prev.includes(currentQuestion.id)) {
                return prev.filter(id => id !== currentQuestion.id);
            } else {
                return [...prev, currentQuestion.id];
            }
        });
    };

    const handleSubmit = useCallback(async () => {
        setIsSubmitting(true);

        if (onSubmit) {
            // Calculate time taken
            const initialTime = initialSession.remainingTime || 0;
            const timeTaken = Math.max(0, initialTime - remainingTime);
            // Wait for parent onSubmit to finish
            await onSubmit(answers, timeTaken);
            // Parent handles navigation or state update
            setIsSubmitting(false);
            return;
        }

        try {
            const response = await fetch(`/api/test/${sessionId}/submit`, {
                method: 'POST',
            });

            const data = await response.json();

            if (data.success) {
                router.push(`/test/${sessionId}/results`);
            } else {
                alert('Failed to submit test');
                setIsSubmitting(false);
            }
        } catch (error) {
            console.error('Submit error:', error);
            alert('Failed to submit test');
            setIsSubmitting(false);
        }
    }, [sessionId, router, onSubmit, answers, remainingTime, initialSession]);

    const currentQuestion = questions[currentIndex];
    const attemptedCount = Object.keys(answers).length;
    const unattemptedCount = questions.length - attemptedCount;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            {/* Header - Timer & Stats */}
            <div className="sticky top-0 z-50 bg-white shadow-md border-b-2 border-indigo-600">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-6">
                            <div className="text-center">
                                <div className={`text-3xl font-bold ${remainingTime < 300 ? 'text-red-600' : 'text-indigo-600'
                                    }`}>
                                    {formatTime(remainingTime)}
                                </div>
                                <div className="text-xs text-gray-600">Time Remaining</div>
                            </div>

                            <div className="h-12 w-px bg-gray-300"></div>

                            <div className="flex gap-4">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-green-600">{attemptedCount}</div>
                                    <div className="text-xs text-gray-600">Attempted</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-gray-600">{unattemptedCount}</div>
                                    <div className="text-xs text-gray-600">Unattempted</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-yellow-600">{markedForReview.length}</div>
                                    <div className="text-xs text-gray-600">Marked</div>
                                </div>
                            </div>
                        </div>

                        {tabSwitchCount > 0 && (
                            <div className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                                ⚠️ Tab Switches: {tabSwitchCount}
                            </div>
                        )}

                        <button
                            onClick={() => setShowSubmitConfirm(true)}
                            className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
                        >
                            Submit Test
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-6">
                <div className="grid lg:grid-cols-4 gap-6">
                    {/* Question Palette */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-xl shadow-lg p-4 sticky top-24">
                            <h3 className="font-bold text-lg mb-4">Question Palette</h3>
                            <div className="grid grid-cols-5 lg:grid-cols-4 gap-2">
                                {questions.map((q, idx) => {
                                    const isAnswered = answers[q.id] !== undefined;
                                    const isMarked = markedForReview.includes(q.id);
                                    const isCurrent = idx === currentIndex;

                                    return (
                                        <button
                                            key={q.id}
                                            onClick={() => setCurrentIndex(idx)}
                                            className={`aspect-square rounded-lg font-semibold text-sm transition-all ${isCurrent
                                                ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                                                : isMarked
                                                    ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-500'
                                                    : isAnswered
                                                        ? 'bg-green-500 text-white hover:bg-green-600'
                                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                }`}
                                        >
                                            {idx + 1}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mt-4 space-y-2 text-xs">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-green-500 rounded"></div>
                                    <span>Answered</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-gray-200 rounded"></div>
                                    <span>Not Answered</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-yellow-400 rounded"></div>
                                    <span>Marked for Review</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-indigo-600 rounded"></div>
                                    <span>Current</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Question Card */}
                    <div className="lg:col-span-3">
                        {currentQuestion && (
                            <QuestionCard
                                question={currentQuestion}
                                questionNumber={currentIndex + 1}
                                userAnswer={answers[currentQuestion.id]}
                                onAnswerChange={handleAnswerChange}
                                isMarkedForReview={markedForReview.includes(currentQuestion.id)}
                                onToggleReview={handleToggleReview}
                                shuffleOptions={true}
                            />
                        )}

                        {/* Navigation */}
                        <div className="mt-6 flex justify-between">
                            <button
                                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                                disabled={currentIndex === 0}
                                className="px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                ← Previous
                            </button>

                            {currentIndex < questions.length - 1 ? (
                                <button
                                    onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                                    className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700"
                                >
                                    Next →
                                </button>
                            ) : (
                                <button
                                    onClick={() => setShowSubmitConfirm(true)}
                                    className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700"
                                >
                                    Submit Test
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Submit Confirmation Modal */}
            {showSubmitConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
                        <div className="text-center mb-6">
                            <h3 className="text-2xl font-bold mb-2">Submit Test?</h3>
                            <p className="text-gray-600">You cannot change answers after submission.</p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2">
                            <div className="flex justify-between">
                                <span>Total Questions</span>
                                <span className="font-bold">{questions.length}</span>
                            </div>
                            <div className="flex justify-between text-green-700">
                                <span>Attempted</span>
                                <span className="font-bold">{attemptedCount}</span>
                            </div>
                            <div className="flex justify-between text-red-600">
                                <span>Unattempted</span>
                                <span className="font-bold">{unattemptedCount}</span>
                            </div>
                            <div className="flex justify-between text-indigo-600">
                                <span>Time Remaining</span>
                                <span className="font-bold">{formatTime(remainingTime)}</span>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => setShowSubmitConfirm(false)}
                                disabled={isSubmitting}
                                className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="flex-1 px-4 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-lg"
                            >
                                {isSubmitting ? 'Submitting...' : 'Yes, Submit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
