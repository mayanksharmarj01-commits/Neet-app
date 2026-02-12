import { createClient } from '@/lib/supabase/server';

export interface MockTest {
    id: string;
    title: string;
    description: string;
    mockType: 'subject' | 'chapter' | 'full_syllabus' | 'custom';
    subjectId?: string;
    chapterIds?: string[];
    difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
    totalQuestions: number;
    durationMinutes: number;
    totalMarks: number;
    isActive: boolean;
    isPremium: boolean;
}

export interface LeaderboardEntry {
    userId: string;
    userName: string;
    rank: number;
    percentile: number;
    totalScore: number;
    mockScore: number;
    practiceScore: number;
    mocksCompleted: number;
    accuracy: number;
}

/**
 * Check if user can take a mock test (subscription & weekly limit)
 */
export async function canTakeMockTest(userId: string): Promise<{
    allowed: boolean;
    reason?: string;
    remainingMocks?: number;
}> {
    const supabase = createClient();

    // Check subscription status
    const { data: user } = await supabase
        .from('users')
        .select('subscription_status')
        .eq('id', userId)
        .single();

    // Paid users have unlimited access
    if (user?.subscription_status === 'active' || user?.subscription_status === 'trialing') {
        return { allowed: true };
    }

    // Check weekly limit using database function
    const { data: canTake } = await supabase
        .rpc('check_weekly_mock_limit', { p_user_id: userId });

    if (!canTake) {
        return {
            allowed: false,
            reason: 'You have reached your weekly limit of 2 mock tests. Upgrade to premium for unlimited access.',
            remainingMocks: 0,
        };
    }

    // Get current week's usage
    const weekStart = getWeekStart();
    const { data: limitData } = await supabase
        .from('user_mock_limits')
        .select('mocks_taken, free_limit')
        .eq('user_id', userId)
        .eq('week_start', weekStart)
        .single();

    const remaining = (limitData?.free_limit || 2) - (limitData?.mocks_taken || 0);

    return {
        allowed: true,
        remainingMocks: remaining,
    };
}

/**
 * Get week start date (Monday)
 */
function getWeekStart(): string {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().split('T')[0];
}

/**
 * Fetch available mock tests
 */
export async function fetchMockTests(filters?: {
    mockType?: string;
    subjectId?: string;
    difficulty?: string;
    isPremium?: boolean;
}): Promise<MockTest[]> {
    const supabase = createClient();

    let query = supabase
        .from('mock_tests')
        .select('*')
        .eq('is_active', true);

    if (filters?.mockType) {
        query = query.eq('mock_type', filters.mockType);
    }

    if (filters?.subjectId) {
        query = query.eq('subject_id', filters.subjectId);
    }

    if (filters?.difficulty) {
        query = query.eq('difficulty', filters.difficulty);
    }

    if (filters?.isPremium !== undefined) {
        query = query.eq('is_premium', filters.isPremium);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching mock tests:', error);
        return [];
    }

    return data as MockTest[];
}

/**
 * Start a mock test
 */
export async function startMockTest(
    userId: string,
    mockTestId: string
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    const supabase = createClient();

    // Check if user can take mock
    const canTake = await canTakeMockTest(userId);
    if (!canTake.allowed) {
        return { success: false, error: canTake.reason };
    }

    // Fetch mock test details
    const { data: mockTest } = await supabase
        .from('mock_tests')
        .select('*')
        .eq('id', mockTestId)
        .single();

    if (!mockTest) {
        return { success: false, error: 'Mock test not found' };
    }

    // Fetch questions based on mock test criteria
    let questionQuery = supabase
        .from('questions')
        .select('*')
        .eq('is_active', true);

    if (mockTest.subject_id) {
        questionQuery = questionQuery.eq('subject_id', mockTest.subject_id);
    }

    if (mockTest.chapter_ids && mockTest.chapter_ids.length > 0) {
        questionQuery = questionQuery.in('chapter_id', mockTest.chapter_ids);
    }

    if (mockTest.difficulty !== 'mixed') {
        questionQuery = questionQuery.eq('difficulty', mockTest.difficulty);
    }

    questionQuery = questionQuery.limit(mockTest.total_questions);

    const { data: questions } = await questionQuery;

    if (!questions || questions.length === 0) {
        return { success: false, error: 'No questions available for this mock test' };
    }

    // Shuffle questions
    const shuffled = [...questions];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const questionIds = shuffled.map(q => q.id);
    const sessionId = crypto.randomUUID();

    // Create test session
    const { error: sessionError } = await supabase
        .from('test_sessions')
        .insert({
            id: sessionId,
            user_id: userId,
            started_at: new Date().toISOString(),
            duration_seconds: mockTest.duration_minutes * 60,
            question_ids: questionIds,
            current_question_index: 0,
            answers: {},
            marked_for_review: [],
            tab_switch_count: 0,
        });

    if (sessionError) {
        return { success: false, error: 'Failed to create session' };
    }

    // Create mock attempt record
    const { error: attemptError } = await supabase
        .from('user_mock_attempts')
        .insert({
            user_id: userId,
            mock_test_id: mockTestId,
            session_id: sessionId,
            status: 'in_progress',
            max_score: mockTest.total_marks,
        });

    if (attemptError) {
        return { success: false, error: 'Failed to create attempt record' };
    }

    // Increment mock count for free users
    await supabase.rpc('increment_mock_count', { p_user_id: userId });

    return { success: true, sessionId };
}

/**
 * Complete mock test and update stats
 */
export async function completeMockTest(
    userId: string,
    mockAttemptId: string,
    results: {
        totalScore: number;
        percentage: number;
        questionsAttempted: number;
        correctAnswers: number;
        incorrectAnswers: number;
        timeTakenSeconds: number;
    }
): Promise<void> {
    const supabase = createClient();

    await supabase
        .from('user_mock_attempts')
        .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            total_score: results.totalScore,
            percentage: results.percentage,
            questions_attempted: results.questionsAttempted,
            correct_answers: results.correctAnswers,
            incorrect_answers: results.incorrectAnswers,
            time_taken_seconds: results.timeTakenSeconds,
        })
        .eq('id', mockAttemptId);
}

/**
 * Get leaderboard (from cache)
 */
export async function getLeaderboard(
    limit: number = 100,
    offset: number = 0
): Promise<LeaderboardEntry[]> {
    const supabase = createClient();

    const { data } = await supabase
        .from('leaderboard_cache')
        .select(`
            user_id,
            rank,
            percentile,
            total_score,
            mock_score,
            practice_score,
            mocks_completed,
            accuracy,
            users (
                full_name,
                email
            )
        `)
        .order('rank', { ascending: true })
        .range(offset, offset + limit - 1);

    if (!data) return [];

    return data.map((entry: any) => ({
        userId: entry.user_id,
        userName: entry.users?.full_name || entry.users?.email || 'Anonymous',
        rank: entry.rank,
        percentile: entry.percentile,
        totalScore: entry.total_score,
        mockScore: entry.mock_score,
        practiceScore: entry.practice_score,
        mocksCompleted: entry.mocks_completed,
        accuracy: entry.accuracy,
    }));
}

/**
 * Get user rank and percentile
 */
export async function getUserRank(userId: string): Promise<{
    rank: number;
    percentile: number;
    totalScore: number;
    mockScore: number;
    practiceScore: number;
} | null> {
    const supabase = createClient();

    const { data } = await supabase
        .from('leaderboard_cache')
        .select('rank, percentile, total_score, mock_score, practice_score')
        .eq('user_id', userId)
        .single();

    if (!data) return null;

    return {
        rank: data.rank,
        percentile: data.percentile,
        totalScore: data.total_score,
        mockScore: data.mock_score,
        practiceScore: data.practice_score,
    };
}

/**
 * Update daily practice stats
 */
export async function updateDailyPractice(
    userId: string,
    questionsAttempted: number,
    correctAnswers: number,
    points: number,
    timeSpentSeconds: number
): Promise<void> {
    const supabase = createClient();

    const today = new Date().toISOString().split('T')[0];

    // Upsert daily stats
    await supabase
        .from('daily_practice_stats')
        .upsert({
            user_id: userId,
            practice_date: today,
            questions_attempted: questionsAttempted,
            correct_answers: correctAnswers,
            total_points: points,
            time_spent_seconds: timeSpentSeconds,
        }, {
            onConflict: 'user_id,practice_date',
        });
}

/**
 * Get user's mock history
 */
export async function getUserMockHistory(
    userId: string,
    limit: number = 10
): Promise<any[]> {
    const supabase = createClient();

    const { data } = await supabase
        .from('user_mock_attempts')
        .select(`
            *,
            mock_tests (
                title,
                mock_type,
                total_marks
            )
        `)
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(limit);

    return data || [];
}
