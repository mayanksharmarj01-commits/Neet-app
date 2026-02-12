import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { MockTestSelector } from '@/features/mock/components/mock-test-selector';
import { canTakeMockTest } from '@/features/mock/services/mock-test.service';

export default async function MockPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/auth/login');
    }

    // Get subscription status and limits
    const limitCheck = await canTakeMockTest(user.id);

    return (
        <div>
            {/* Limit Warning */}
            {!limitCheck.allowed && (
                <div className="max-w-7xl mx-auto px-4 pt-8">
                    <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-6 mb-6">
                        <div className="flex items-start gap-4">
                            <div className="text-4xl">⚠️</div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-yellow-900 mb-2">
                                    Weekly Limit Reached
                                </h3>
                                <p className="text-yellow-800 mb-4">{limitCheck.reason}</p>
                                <a
                                    href="/pricing"
                                    className="inline-block px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
                                >
                                    Upgrade to Premium
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Limit Info for Free Users */}
            {limitCheck.allowed && limitCheck.remainingMocks !== undefined && (
                <div className="max-w-7xl mx-auto px-4 pt-8">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                        <p className="text-sm text-blue-800">
                            📊 You have <strong>{limitCheck.remainingMocks}</strong> mock test{limitCheck.remainingMocks !== 1 ? 's' : ''} remaining this week.
                            {' '}
                            <a href="/pricing" className="underline font-semibold">Upgrade to Premium</a> for unlimited access.
                        </p>
                    </div>
                </div>
            )}

            <MockTestSelector />
        </div>
    );
}
