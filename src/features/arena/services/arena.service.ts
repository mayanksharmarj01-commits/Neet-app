import { createClient } from '@/lib/supabase/server';

export interface CreateArenaParams {
    title: string;
    description?: string;
    isPublic: boolean;
    maxParticipants: number;
    scheduledStartTime: string;
    durationMinutes: number;
    questionFilters: {
        subjectId?: string;
        difficulty?: string;
        topics?: string[];
        tags?: string[];
    };
    totalQuestions: number;
}

/**
 * Check if user can create arena (2 per day limit)
 */
export async function canCreateArena(userId: string): Promise<{
    allowed: boolean;
    reason?: string;
    remaining?: number;
}> {
    const supabase = createClient();

    const { data: canCreate } = await supabase
        .rpc('check_daily_arena_limit', { p_user_id: userId });

    if (!canCreate) {
        return {
            allowed: false,
            reason: 'You have reached your daily limit of 2 arenas. Try again tomorrow.',
            remaining: 0,
        };
    }

    // Get current count
    const today = new Date().toISOString().split('T')[0];
    const { data: limitData } = await supabase
        .from('user_arena_limits')
        .select('arenas_created, daily_limit')
        .eq('user_id', userId)
        .eq('arena_date', today)
        .single();

    const remaining = (limitData?.daily_limit || 2) - (limitData?.arenas_created || 0);

    return {
        allowed: true,
        remaining,
    };
}

/**
 * Create a new arena
 */
export async function createArena(
    userId: string,
    params: CreateArenaParams
): Promise<{ success: boolean; arenaId?: string; roomCode?: string; error?: string }> {
    const supabase = createClient();

    // Check daily limit
    const canCreate = await canCreateArena(userId);
    if (!canCreate.allowed) {
        return { success: false, error: canCreate.reason };
    }

    // Fetch questions based on filters
    let questionQuery = supabase
        .from('questions')
        .select('id')
        .eq('is_active', true);

    if (params.questionFilters.subjectId) {
        questionQuery = questionQuery.eq('subject_id', params.questionFilters.subjectId);
    }

    if (params.questionFilters.difficulty) {
        questionQuery = questionQuery.eq('difficulty', params.questionFilters.difficulty);
    }

    if (params.questionFilters.topics && params.questionFilters.topics.length > 0) {
        questionQuery = questionQuery.overlaps('topics', params.questionFilters.topics);
    }

    questionQuery = questionQuery.limit(params.totalQuestions);

    const { data: questions, error: questionError } = await questionQuery;

    if (questionError || !questions || questions.length === 0) {
        return { success: false, error: 'No questions found matching your filters' };
    }

    // Shuffle questions
    const shuffled = [...questions];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const questionIds = shuffled.map(q => q.id);

    // Generate unique room code
    let roomCode = '';
    let isUnique = false;

    while (!isUnique) {
        // Generate 6-character code
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        roomCode = '';
        for (let i = 0; i < 6; i++) {
            roomCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // Check if unique
        const { data: existing } = await supabase
            .from('arenas')
            .select('id')
            .eq('room_code', roomCode)
            .single();

        isUnique = !existing;
    }

    // Create arena
    const { data: arena, error: createError } = await supabase
        .from('arenas')
        .insert({
            title: params.title,
            description: params.description,
            created_by: userId,
            room_code: roomCode,
            is_public: params.isPublic,
            max_participants: Math.min(params.maxParticipants, 50),
            scheduled_start_time: params.scheduledStartTime,
            duration_minutes: params.durationMinutes,
            question_filters: params.questionFilters,
            question_ids: questionIds,
            total_questions: questionIds.length,
        })
        .select()
        .single();

    if (createError || !arena) {
        return { success: false, error: 'Failed to create arena' };
    }

    // Increment arena count
    await supabase.rpc('increment_arena_count', { p_user_id: userId });

    // Auto-join creator as host
    await supabase
        .from('arena_participants')
        .insert({
            arena_id: arena.id,
            user_id: userId,
            is_host: true,
        });

    return {
        success: true,
        arenaId: arena.id,
        roomCode: arena.room_code,
    };
}

/**
 * Join arena by room code
 */
export async function joinArenaByCode(
    userId: string,
    roomCode: string
): Promise<{ success: boolean; arenaId?: string; error?: string }> {
    const supabase = createClient();

    // Find arena
    const { data: arena, error: findError } = await supabase
        .from('arenas')
        .select('*')
        .eq('room_code', roomCode.toUpperCase())
        .single();

    if (findError || !arena) {
        return { success: false, error: 'Arena not found. Please check the room code.' };
    }

    // Check if arena is full
    if (arena.participant_count >= arena.max_participants) {
        return { success: false, error: 'Arena is full (max 50 participants)' };
    }

    // Check if already joined
    const { data: existing } = await supabase
        .from('arena_participants')
        .select('id')
        .eq('arena_id', arena.id)
        .eq('user_id', userId)
        .single();

    if (existing) {
        return { success: true, arenaId: arena.id }; // Already joined
    }

    // Join arena
    const { error: joinError } = await supabase
        .from('arena_participants')
        .insert({
            arena_id: arena.id,
            user_id: userId,
            is_host: false,
        });

    if (joinError) {
        return { success: false, error: 'Failed to join arena' };
    }

    return { success: true, arenaId: arena.id };
}

/**
 * Start arena (host only)
 */
export async function startArena(arenaId: string, userId: string): Promise<boolean> {
    const supabase = createClient();

    // Verify user is host
    const { data: participant } = await supabase
        .from('arena_participants')
        .select('is_host')
        .eq('arena_id', arenaId)
        .eq('user_id', userId)
        .single();

    if (!participant?.is_host) {
        return false;
    }

    // Update arena status
    const { error } = await supabase
        .from('arenas')
        .update({
            status: 'live',
            actual_start_time: new Date().toISOString(),
        })
        .eq('id', arenaId);

    return !error;
}

/**
 * Submit arena answers
 */
export async function submitArenaAnswers(
    arenaId: string,
    userId: string,
    answers: Record<string, any>,
    timeTakenSeconds: number
): Promise<{ success: boolean; score?: number; rank?: number }> {
    const supabase = createClient();

    // Get arena questions
    const { data: arena } = await supabase
        .from('arenas')
        .select('question_ids')
        .eq('id', arenaId)
        .single();

    if (!arena) {
        return { success: false };
    }

    // Get questions for evaluation
    const { data: questions } = await supabase
        .from('questions')
        .select('*')
        .in('id', arena.question_ids);

    if (!questions) {
        return { success: false };
    }

    // Evaluate answers
    let score = 0;
    let correctCount = 0;
    let incorrectCount = 0;

    for (const question of questions) {
        const userAnswer = answers[question.id];

        if (userAnswer !== undefined && userAnswer !== null) {
            const isCorrect = evaluateAnswer(question, userAnswer);

            if (isCorrect) {
                correctCount++;
                score += question.points || 0;
            } else {
                incorrectCount++;
                score -= question.negative_points || 0;
            }
        }
    }

    // Update participant
    const { error } = await supabase
        .from('arena_participants')
        .update({
            submitted_at: new Date().toISOString(),
            answers,
            score,
            correct_count: correctCount,
            incorrect_count: incorrectCount,
            time_taken_seconds: timeTakenSeconds,
            can_view_leaderboard: true,
        })
        .eq('arena_id', arenaId)
        .eq('user_id', userId);

    if (error) {
        return { success: false };
    }

    // Calculate rankings
    await supabase.rpc('update_arena_rankings', { p_arena_id: arenaId });

    // Get user's rank
    const { data: participant } = await supabase
        .from('arena_participants')
        .select('rank')
        .eq('arena_id', arenaId)
        .eq('user_id', userId)
        .single();

    return {
        success: true,
        score,
        rank: participant?.rank,
    };
}

/**
 * Mark user as viewed solutions (hides leaderboard)
 */
export async function markSolutionsViewed(arenaId: string, userId: string): Promise<void> {
    const supabase = createClient();

    await supabase
        .from('arena_participants')
        .update({
            has_viewed_solutions: true,
            can_view_leaderboard: false, // Hide leaderboard after viewing solutions
        })
        .eq('arena_id', arenaId)
        .eq('user_id', userId);
}

/**
 * Get arena leaderboard (only if user submitted or is host)
 */
export async function getArenaLeaderboard(
    arenaId: string,
    userId: string
): Promise<any[] | null> {
    const supabase = createClient();

    // Check if user can view leaderboard
    const { data: participant } = await supabase
        .from('arena_participants')
        .select('can_view_leaderboard, is_host, has_viewed_solutions')
        .eq('arena_id', arenaId)
        .eq('user_id', userId)
        .single();

    if (!participant?.can_view_leaderboard && !participant?.is_host) {
        return null; // Cannot view leaderboard
    }

    if (participant?.has_viewed_solutions) {
        return null; // Leaderboard hidden after viewing solutions
    }

    // Get leaderboard
    const { data: leaderboard } = await supabase
        .from('arena_participants')
        .select(`
            user_id,
            score,
            correct_count,
            incorrect_count,
            time_taken_seconds,
            rank,
            submitted_at,
            users (
                full_name,
                email
            )
        `)
        .eq('arena_id', arenaId)
        .not('submitted_at', 'is', null)
        .order('rank', { ascending: true });

    return leaderboard || [];
}

/**
 * Simple answer evaluation (reuse from question engine)
 */
function evaluateAnswer(question: any, userAnswer: any): boolean {
    switch (question.question_type) {
        case 'mcq':
        case 'true_false':
            return userAnswer === question.correct_answers[0];

        case 'multiple_correct':
            const userAnswers = Array.isArray(userAnswer) ? userAnswer : [];
            const correctAnswers = question.correct_answers;
            return (
                userAnswers.length === correctAnswers.length &&
                userAnswers.every((a: any) => correctAnswers.includes(a))
            );

        case 'integer':
            return parseInt(userAnswer) === parseInt(question.correct_answers[0]);

        default:
            return JSON.stringify(userAnswer) === JSON.stringify(question.correct_answers[0]);
    }
}

/**
 * Get user's arena stats
 */
export async function getUserArenaStats(userId: string): Promise<any> {
    const supabase = createClient();

    const { data: stats } = await supabase
        .from('arena_rankings')
        .select('*')
        .eq('user_id', userId)
        .single();

    return stats || {
        total_arenas: 0,
        total_wins: 0,
        arena_points: 0,
        tier: 'bronze',
    };
}
