'use client';

import { useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/razorpay/razorpay.service';

export function PricingPlans() {
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [subscribing, setSubscribing] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            const response = await fetch('/api/subscription/plans');
            const data = await response.json();

            if (data.success) {
                setPlans(data.plans);
            }
        } catch (err) {
            console.error('Error fetching plans:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubscribe = async (planId: string) => {
        setSubscribing(true);
        setError('');
        setSelectedPlan(planId);

        try {
            const response = await fetch('/api/subscription/initiate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ planId }),
            });

            const data = await response.json();

            if (data.success && data.paymentLink) {
                // Redirect to Razorpay payment link
                window.location.href = data.paymentLink;
            } else {
                setError(data.error || 'Failed to initiate payment');
                setSubscribing(false);
            }
        } catch (err) {
            console.error('Error initiating subscription:', err);
            setError('An unexpected error occurred');
            setSubscribing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 py-16 px-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-16">
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
                        Choose Your Plan
                    </h1>
                    <p className="text-xl text-gray-600">
                        Unlock unlimited access to mocks, arenas, and premium features
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="max-w-2xl mx-auto mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800">{error}</p>
                    </div>
                )}

                {/* Pricing Cards */}
                <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {plans.map((plan, index) => {
                        const isPopular = index === 1; // Middle plan
                        const discount = plan.features?.discount;

                        return (
                            <div
                                key={plan.id}
                                className={`bg-white rounded-2xl shadow-xl p-8 relative ${isPopular ? 'ring-4 ring-indigo-600 scale-105' : ''
                                    }`}
                            >
                                {/* Popular Badge */}
                                {isPopular && (
                                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                                        <span className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-2 rounded-full text-sm font-bold">
                                            ⭐ MOST POPULAR
                                        </span>
                                    </div>
                                )}

                                {/* Discount Badge */}
                                {discount && (
                                    <div className="absolute top-4 right-4">
                                        <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                                            Save {discount}
                                        </span>
                                    </div>
                                )}

                                {/* Plan Name */}
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>

                                {/* Description */}
                                {plan.description && (
                                    <p className="text-gray-600 mb-6">{plan.description}</p>
                                )}

                                {/* Price */}
                                <div className="mb-6">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-bold text-gray-900">
                                            {formatCurrency(plan.price_inr)}
                                        </span>
                                        <span className="text-gray-600">/ {plan.duration_days} days</span>
                                    </div>
                                    <div className="text-sm text-gray-500 mt-1">
                                        {formatCurrency(Math.floor(plan.price_inr / plan.duration_days))} per day
                                    </div>
                                </div>

                                {/* Features */}
                                <div className="space-y-3 mb-8">
                                    <div className="flex items-center gap-2 text-sm">
                                        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span>Unlimited Mock Tests</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span>Unlimited Arenas</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span>Priority Support</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span>Detailed Analytics</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span>All Future Features</span>
                                    </div>
                                </div>

                                {/* Subscribe Button */}
                                <button
                                    onClick={() => handleSubscribe(plan.id)}
                                    disabled={subscribing && selectedPlan === plan.id}
                                    className={`w-full py-4 px-6 rounded-lg font-bold text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${isPopular
                                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
                                            : 'bg-gray-900 hover:bg-gray-800'
                                        }`}
                                >
                                    {subscribing && selectedPlan === plan.id ? (
                                        <span className="flex items-center justify-center">
                                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Processing...
                                        </span>
                                    ) : (
                                        'Subscribe Now'
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* No Refund Policy Notice */}
                <div className="mt-12 max-w-4xl mx-auto bg-yellow-50 border-2 border-yellow-400 rounded-xl p-6">
                    <div className="flex items-start gap-4">
                        <div className="text-3xl">⚠️</div>
                        <div>
                            <h3 className="font-bold text-yellow-900 mb-2">Important: No Refund Policy</h3>
                            <p className="text-sm text-yellow-800">
                                All subscription payments are <strong>non-refundable</strong>. Please review the plan carefully before subscribing.
                                By proceeding with payment, you agree to our strict no-refund policy. Subscriptions are valid for the duration specified and cannot be canceled for a refund.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Secure Payment Notice */}
                <div className="mt-6 text-center text-sm text-gray-600">
                    <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Secure payments powered by Razorpay • 256-bit SSL encryption
                </div>
            </div>
        </div>
    );
}
