'use client';

import { useState, useEffect } from 'react';
import { LatexRenderer } from '@/components/latex-renderer';
import Image from 'next/image';
import { Question, QuestionOption } from '@/features/mock/services/question-engine.service';

interface QuestionCardProps {
    question: Question;
    questionNumber: number;
    userAnswer: any;
    onAnswerChange: (answer: any) => void;
    isMarkedForReview: boolean;
    onToggleReview: () => void;
    shuffleOptions?: boolean;
}

export function QuestionCard({
    question,
    questionNumber,
    userAnswer,
    onAnswerChange,
    isMarkedForReview,
    onToggleReview,
    shuffleOptions = true,
}: QuestionCardProps) {
    const [shuffledOptions, setShuffledOptions] = useState<QuestionOption[]>(question.options);

    useEffect(() => {
        if (shuffleOptions && question.options) {
            // Shuffle options only once when component mounts
            const shuffled = [...question.options];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            setShuffledOptions(shuffled);
        }
    }, [question.id]); // Only shuffle when question changes

    const renderOptions = () => {
        switch (question.questionType) {
            case 'mcq':
            case 'true_false':
                return renderSingleChoice();
            case 'multiple_correct':
                return renderMultipleChoice();
            case 'integer':
                return renderIntegerInput();
            case 'assertion_reason':
                return renderAssertionReason();
            case 'match_column':
                return renderMatchColumn();
            case 'statement_based':
                return renderStatementBased();
            default:
                return null;
        }
    };

    const renderSingleChoice = () => (
        <div className="space-y-3">
            {shuffledOptions.map((option, index) => (
                <label
                    key={option.id}
                    className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${userAnswer === option.id
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                        }`}
                >
                    <input
                        type="radio"
                        name={`question-${question.id}`}
                        value={option.id}
                        checked={userAnswer === option.id}
                        onChange={() => onAnswerChange(option.id)}
                        className="mt-1 h-4 w-4 text-indigo-600"
                    />
                    <div className="ml-3 flex-1">
                        <div className="flex items-start gap-2">
                            <span className="font-semibold text-gray-700 min-w-[30px]">
                                {String.fromCharCode(65 + index)}.
                            </span>
                            {option.latex ? (
                                <LatexRenderer content={option.latex} className="flex-1" />
                            ) : (
                                <span className="flex-1">{option.text}</span>
                            )}
                        </div>
                        {option.image && (
                            <div className="mt-2 ml-7">
                                <Image
                                    src={option.image}
                                    alt={`Option ${index + 1}`}
                                    width={200}
                                    height={150}
                                    className="rounded border"
                                />
                            </div>
                        )}
                    </div>
                </label>
            ))}
        </div>
    );

    const renderMultipleChoice = () => {
        const selectedAnswers = Array.isArray(userAnswer) ? userAnswer : [];

        const toggleOption = (optionId: string) => {
            if (selectedAnswers.includes(optionId)) {
                onAnswerChange(selectedAnswers.filter(id => id !== optionId));
            } else {
                onAnswerChange([...selectedAnswers, optionId]);
            }
        };

        return (
            <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-3">Select all correct answers</p>
                {shuffledOptions.map((option, index) => (
                    <label
                        key={option.id}
                        className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedAnswers.includes(option.id)
                                ? 'border-indigo-600 bg-indigo-50'
                                : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                            }`}
                    >
                        <input
                            type="checkbox"
                            checked={selectedAnswers.includes(option.id)}
                            onChange={() => toggleOption(option.id)}
                            className="mt-1 h-4 w-4 text-indigo-600 rounded"
                        />
                        <div className="ml-3 flex-1">
                            <div className="flex items-start gap-2">
                                <span className="font-semibold text-gray-700 min-w-[30px]">
                                    {String.fromCharCode(65 + index)}.
                                </span>
                                {option.latex ? (
                                    <LatexRenderer content={option.latex} className="flex-1" />
                                ) : (
                                    <span className="flex-1">{option.text}</span>
                                )}
                            </div>
                        </div>
                    </label>
                ))}
            </div>
        );
    };

    const renderIntegerInput = () => (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter your answer (integer value):
            </label>
            <input
                type="number"
                value={userAnswer || ''}
                onChange={(e) => onAnswerChange(e.target.value)}
                className="w-full max-w-xs px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Enter integer"
            />
        </div>
    );

    const renderAssertionReason = () => (
        <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Assertion (A):</h4>
                {question.options[0]?.latex ? (
                    <LatexRenderer content={question.options[0].latex} />
                ) : (
                    <p>{question.options[0]?.text}</p>
                )}
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2">Reason (R):</h4>
                {question.options[1]?.latex ? (
                    <LatexRenderer content={question.options[1].latex} />
                ) : (
                    <p>{question.options[1]?.text}</p>
                )}
            </div>

            <div className="space-y-2">
                {question.options.slice(2).map((option) => (
                    <label
                        key={option.id}
                        className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${userAnswer === option.id
                                ? 'border-indigo-600 bg-indigo-50'
                                : 'border-gray-200 hover:border-indigo-300'
                            }`}
                    >
                        <input
                            type="radio"
                            name={`question-${question.id}`}
                            value={option.id}
                            checked={userAnswer === option.id}
                            onChange={() => onAnswerChange(option.id)}
                            className="mt-1 h-4 w-4 text-indigo-600"
                        />
                        <span className="ml-3">{option.text}</span>
                    </label>
                ))}
            </div>
        </div>
    );

    const renderMatchColumn = () => {
        const matches = userAnswer || {};

        return (
            <div className="grid md:grid-cols-2 gap-6">
                <div>
                    <h4 className="font-semibold mb-3">Column A</h4>
                    <div className="space-y-2">
                        {question.options.slice(0, 4).map((option, index) => (
                            <div key={option.id} className="p-3 bg-gray-50 rounded border">
                                <span className="font-semibold mr-2">{index + 1}.</span>
                                {option.latex ? (
                                    <LatexRenderer content={option.latex} inline />
                                ) : (
                                    <span>{option.text}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <h4 className="font-semibold mb-3">Column B (Select match for each)</h4>
                    <div className="space-y-3">
                        {question.options.slice(0, 4).map((_, index) => (
                            <select
                                key={index}
                                value={matches[index] || ''}
                                onChange={(e) => onAnswerChange({ ...matches, [index]: e.target.value })}
                                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">Select match</option>
                                {['P', 'Q', 'R', 'S'].map((letter) => (
                                    <option key={letter} value={letter}>{letter}</option>
                                ))}
                            </select>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderStatementBased = () => (
        <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg border">
                <h4 className="font-semibold mb-2">Statements:</h4>
                {question.options.slice(0, -4).map((option, index) => (
                    <div key={option.id} className="mb-2">
                        <span className="font-semibold mr-2">({index + 1})</span>
                        {option.latex ? (
                            <LatexRenderer content={option.latex} inline />
                        ) : (
                            <span>{option.text}</span>
                        )}
                    </div>
                ))}
            </div>

            <div className="space-y-2">
                {question.options.slice(-4).map((option) => (
                    <label
                        key={option.id}
                        className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${userAnswer === option.id
                                ? 'border-indigo-600 bg-indigo-50'
                                : 'border-gray-200 hover:border-indigo-300'
                            }`}
                    >
                        <input
                            type="radio"
                            name={`question-${question.id}`}
                            value={option.id}
                            checked={userAnswer === option.id}
                            onChange={() => onAnswerChange(option.id)}
                            className="mt-1 h-4 w-4 text-indigo-600"
                        />
                        <span className="ml-3">{option.text}</span>
                    </label>
                ))}
            </div>
        </div>
    );

    return (
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
            {/* Question Header */}
            <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-semibold">
                            Question {questionNumber}
                        </span>
                        <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm capitalize">
                            {question.questionType.replace('_', ' ')}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${question.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                                question.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                            }`}>
                            {question.difficulty}
                        </span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{question.title}</h3>
                </div>

                <button
                    onClick={onToggleReview}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${isMarkedForReview
                            ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-400'
                            : 'bg-gray-100 text-gray-700 border-2 border-gray-300 hover:bg-gray-200'
                        }`}
                >
                    {isMarkedForReview ? '⭐ Marked' : '☆ Mark for Review'}
                </button>
            </div>

            {/* Question Description */}
            <div className="mb-6 text-gray-700 leading-relaxed">
                <LatexRenderer content={question.description} />
            </div>

            {/* Question Image (Circuit Diagram, etc.) */}
            {question.image && (
                <div className="mb-6">
                    <Image
                        src={question.image}
                        alt="Question diagram"
                        width={600}
                        height={400}
                        className="rounded-lg border-2 border-gray-200 max-w-full h-auto"
                    />
                </div>
            )}

            {/* Points Info */}
            <div className="mb-6 flex gap-4 text-sm">
                <span className="text-green-600 font-medium">
                    +{question.points} points for correct answer
                </span>
                {question.negativePoints && question.negativePoints > 0 && (
                    <span className="text-red-600 font-medium">
                        -{question.negativePoints} points for incorrect answer
                    </span>
                )}
            </div>

            {/* Options/Answer Input */}
            {renderOptions()}
        </div>
    );
}
