import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function ResultsPage({ params }: { params: { sessionId: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/auth/login');
    }

    // Fetch session
    const { data: session } = await supabase
        .from('test_sessions')
        .select('*')
        .eq('id', params.sessionId)
        .single();

    if (!session || session.user_id !== user.id) {
        redirect('/mock');
    }

    // Fetch all attempts for this session
    const { data: attempts } = await supabase
        .from('user_attempts')
        .select(`
            *,
            questions (
                id,
                title,
                question_type,
                difficulty,
                points,
                negative_points
            )
        `)
        .eq('session_id', params.sessionId);

    // Calculate statistics
    const totalQuestions = session.question_ids.length;
    const attempted = attempts?.filter(a => a.user_answer !== null).length || 0;
    const correct = attempts?.filter(a => a.is_correct).length || 0;
    const incorrect = attempted - correct;
    const totalScore = attempts?.reduce((sum, a) => sum + (a.points_earned || 0), 0) || 0;
    const maxScore = attempts?.reduce((sum, a) =>
        sum + (a.questions?.points || 0), 0) || 0;
    const percentage = maxScore > 0 ? ((totalScore / maxScore) * 100).toFixed(2) : 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 py-12 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-2xl p-8 mb-6">
                    <div className="text-center">
                        <div className="w-20 h-20 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Test Completed!</h1>
                        <p className="text-gray-600">Here's how you performed</p>
                    </div>
                </div>

                {/* Score Card */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-2xl p-8 mb-6 text-white">
                    <div className="text-center mb-6">
                        <div className="text-6xl font-bold mb-2">{totalScore}</div>
                        <div className="text-xl opacity-90">Total Score</div>
                        <div className="text-sm opacity-75 mt-2">out of {maxScore} points</div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
                            <div className="text-3xl font-bold">{percentage}%</div>
                            <div className="text-sm opacity-90">Percentage</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
                            <div className="text-3xl font-bold text-green-300">{correct}</div>
                            <div className="text-sm opacity-90">Correct</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
                            <div className="text-3xl font-bold text-red-300">{incorrect}</div>
                            <div className="text-sm opacity-90">Incorrect</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
                            <div className="text-3xl font-bold text-yellow-300">{totalQuestions - attempted}</div>
                            <div className="text-sm opacity-90">Skipped</div>
                        </div>
                    </div>
                </div>

                {/* Statistics */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <h2 className="text-xl font-bold mb-4">Test Statistics</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-gray-700">Total Questions:</span>
                            <span className="font-bold">{totalQuestions}</span>
                        </div>
                        <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-gray-700">Attempted:</span>
                            <span className="font-bold">{attempted}</span>
                        </div>
                        <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-gray-700">Accuracy:</span>
                            <span className="font-bold">
                                {attempted > 0 ? ((correct / attempted) * 100).toFixed(2) : 0}%
                            </span>
                        </div>
                        <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-gray-700">Tab Switches:</span>
                            <span className={`font-bold ${session.tab_switch_count > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {session.tab_switch_count}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Question-wise Analysis */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <h2 className="text-xl font-bold mb-4">Question-wise Analysis</h2>
                    <div className="space-y-3">
                        {attempts?.map((attempt, index) => (
                            <div
                                key={attempt.id}
                                className={`flex items-center justify-between p-4 rounded-lg border-2 ${attempt.is_correct
                                        ? 'bg-green-50 border-green-200'
                                        : attempt.user_answer !== null
                                            ? 'bg-red-50 border-red-200'
                                            : 'bg-gray-50 border-gray-200'
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${attempt.is_correct
                                            ? 'bg-green-500 text-white'
                                            : attempt.user_answer !== null
                                                ? 'bg-red-500 text-white'
                                                : 'bg-gray-400 text-white'
                                        }`}>
                                        {index + 1}
                                    </div>
                                    <div>
                                        <div className="font-semibold">{attempt.questions?.title || 'Question'}</div>
                                        <div className="text-sm text-gray-600 flex gap-2">
                                            <span className="capitalize">{attempt.questions?.question_type?.replace('_', ' ')}</span>
                                            <span>•</span>
                                            <span className="capitalize">{attempt.questions?.difficulty}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`text-2xl font-bold ${attempt.is_correct ? 'text-green-600' :
                                            attempt.user_answer !== null ? 'text-red-600' : 'text-gray-600'
                                        }`}>
                                        {attempt.points_earned > 0 ? '+' : ''}{attempt.points_earned}
                                    </div>
                                    <div className="text-xs text-gray-600">points</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4">
                    <Link
                        href="/mock"
                        className="flex-1 py-3 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg text-center hover:shadow-xl transition-all"
                    >
                        Take Another Test
                    </Link>
                    <Link
                        href="/dashboard"
                        className="flex-1 py-3 px-6 bg-gray-600 text-white font-semibold rounded-lg text-center hover:bg-gray-700 transition-all"
                    >
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
