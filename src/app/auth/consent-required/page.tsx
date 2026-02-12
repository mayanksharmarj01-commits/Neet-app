'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

function ConsentContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('redirect') || '/dashboard';

    const [acceptTerms, setAcceptTerms] = useState(false);
    const [ageConfirmation, setAgeConfirmation] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMessage('');

        if (!acceptTerms || !ageConfirmation) {
            setErrorMessage('You must accept both terms and confirm your age to continue');
            setLoading(false);
            return;
        }

        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.push('/auth/login');
                return;
            }

            const response = await fetch('/api/auth/consent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user.id,
                    acceptTerms,
                    ageConfirmation,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setErrorMessage(data.error || 'Failed to record consent');
                return;
            }

            // Redirect to intended page
            router.push(redirectTo);
            router.refresh();
        } catch (error) {
            console.error('Consent error:', error);
            setErrorMessage('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-2xl">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Consent Required</h1>
                    <p className="text-gray-600">Before you can access the dashboard, we need your consent</p>
                </div>

                {errorMessage && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800">{errorMessage}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                        <h2 className="text-lg font-semibold text-gray-900">Required Confirmations</h2>

                        <div className="space-y-4">
                            <div className="flex items-start">
                                <input
                                    id="age-confirmation"
                                    type="checkbox"
                                    checked={ageConfirmation}
                                    onChange={(e) => setAgeConfirmation(e.target.checked)}
                                    required
                                    className="mt-1 h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                />
                                <label htmlFor="age-confirmation" className="ml-3 block text-sm text-gray-700">
                                    <span className="font-semibold text-gray-900">Age Declaration:</span> I confirm that I am{' '}
                                    <span className="font-bold text-indigo-600">18 years or older</span>
                                </label>
                            </div>

                            <div className="flex items-start">
                                <input
                                    id="accept-terms"
                                    type="checkbox"
                                    checked={acceptTerms}
                                    onChange={(e) => setAcceptTerms(e.target.checked)}
                                    required
                                    className="mt-1 h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                />
                                <label htmlFor="accept-terms" className="ml-3 block text-sm text-gray-700">
                                    <span className="font-semibold text-gray-900">Terms & Conditions:</span> I have read and agree to the{' '}
                                    <Link href="/terms" target="_blank" className="text-indigo-600 hover:text-indigo-500 font-medium underline">
                                        Terms and Conditions
                                    </Link>{' '}
                                    and{' '}
                                    <Link href="/privacy" target="_blank" className="text-indigo-600 hover:text-indigo-500 font-medium underline">
                                        Privacy Policy
                                    </Link>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex">
                            <svg className="h-5 w-5 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <p className="ml-3 text-sm text-blue-800">
                                Your consent is required by law. This information is securely stored and timestamped for compliance purposes.
                            </p>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !acceptTerms || !ageConfirmation}
                        className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing...
                            </span>
                        ) : (
                            'Continue to Dashboard'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default function ConsentRequiredPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4">
            <Suspense fallback={<div className="text-white">Loading...</div>}>
                <ConsentContent />
            </Suspense>
        </div>
    );
}
