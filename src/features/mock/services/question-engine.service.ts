import { createClient } from '@/lib/supabase/server';

export interface QuestionOption {
    id: string;
    text: string;
    latex?: string;
    image?: string;
    isCorrect?: boolean;
}

export interface Question {
    id: string;
    title: string;
    description: string;
    questionType: 'mcq' | 'multiple_correct' | 'true_false' | 'subjective' | 'integer' | 'assertion_reason' | 'match_column' | 'statement_based';
    difficulty: 'easy' | 'medium' | 'hard';
    options: QuestionOption[];
    correctAnswers: string[];
    explanation?: string;
    hints?: string[];
    points: number;
    negativePoints?: number;
    timeLimitSeconds?: number;
    image?: string;
    tags?: string[];
    topics?: string[];
}

export interface TestSession {
    id: string;
    userId: string;
    startedAt: Date;
    duration: number; // in seconds
    questions: string[]; // question IDs
    currentQuestionIndex: number;
    answers: Record<string, any>;
    markedForReview: string[];
    tabSwitchCount: number;
    lastSavedAt: Date;
}

export interface AttemptResult {
    questionId: string;
    userAnswer: any;
    isCorrect: boolean;
    pointsEarned: number;
    timeTaken: number;
}

/**
 * Fetch questions for a test session
 */
export async function fetchQuestions(
    filters?: {
        difficulty?: string[];
        topics?: string[];
        tags?: string[];
        limit?: number;
    }
): Promise<Question[]> {
    const supabase = createClient();

    let query = supabase
        .from('questions')
        .select('*')
        .eq('is_active', true)
        .is('deleted_at', null);

    if (filters?.difficulty && filters.difficulty.length > 0) {
        query = query.in('difficulty', filters.difficulty);
    }

    if (filters?.topics && filters.topics.length > 0) {
        query = query.contains('topics', filters.topics);
    }

    if (filters?.limit) {
        query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching questions:', error);
        return [];
    }

    return data as Question[];
}

/**
 * Randomize array order (Fisher-Yates shuffle)
 */
export function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Create a new test session
 */
export async function createTestSession(
    userId: string,
    questions: Question[],
    durationMinutes: number
): Promise<string> {
    const supabase = createClient();

    // Randomize question order
    const shuffledQuestions = shuffleArray(questions);
    const questionIds = shuffledQuestions.map(q => q.id);

    const sessionId = crypto.randomUUID();

    // Store session in database (you may want a separate sessions table)
    const { error } = await supabase
        .from('test_sessions')
        .insert({
            id: sessionId,
            user_id: userId,
            started_at: new Date().toISOString(),
            duration_seconds: durationMinutes * 60,
            question_ids: questionIds,
            current_question_index: 0,
            answers: {},
            marked_for_review: [],
            tab_switch_count: 0,
        });

    if (error) {
        console.error('Error creating test session:', error);
        throw new Error('Failed to create test session');
    }

    return sessionId;
}

/**
 * Get test session
 */
export async function getTestSession(sessionId: string): Promise<TestSession | null> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('test_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

    if (error || !data) {
        return null;
    }

    return {
        id: data.id,
        userId: data.user_id,
        startedAt: new Date(data.started_at),
        duration: data.duration_seconds,
        questions: data.question_ids,
        currentQuestionIndex: data.current_question_index,
        answers: data.answers || {},
        markedForReview: data.marked_for_review || [],
        tabSwitchCount: data.tab_switch_count || 0,
        lastSavedAt: new Date(data.updated_at),
    };
}

/**
 * Calculate remaining time for session
 */
export function getRemainingTime(session: TestSession): number {
    const elapsed = Math.floor((Date.now() - session.startedAt.getTime()) / 1000);
    const remaining = session.duration - elapsed;
    return Math.max(0, remaining);
}

/**
 * Update session answers (auto-save)
 */
export async function updateSessionAnswers(
    sessionId: string,
    questionId: string,
    answer: any
): Promise<void> {
    const supabase = createClient();

    // Get current session
    const session = await getTestSession(sessionId);
    if (!session) return;

    // Update answers
    const updatedAnswers = {
        ...session.answers,
        [questionId]: answer,
    };

    await supabase
        .from('test_sessions')
        .update({
            answers: updatedAnswers,
            updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
}

/**
 * Mark question for review
 */
export async function markForReview(
    sessionId: string,
    questionId: string,
    marked: boolean
): Promise<void> {
    const supabase = createClient();

    const session = await getTestSession(sessionId);
    if (!session) return;

    let markedQuestions = session.markedForReview;

    if (marked) {
        if (!markedQuestions.includes(questionId)) {
            markedQuestions.push(questionId);
        }
    } else {
        markedQuestions = markedQuestions.filter(id => id !== questionId);
    }

    await supabase
        .from('test_sessions')
        .update({ marked_for_review: markedQuestions })
        .eq('id', sessionId);
}

/**
 * Track tab switch
 */
export async function incrementTabSwitch(sessionId: string): Promise<void> {
    const supabase = createClient();

    const session = await getTestSession(sessionId);
    if (!session) return;

    await supabase
        .from('test_sessions')
        .update({ tab_switch_count: session.tabSwitchCount + 1 })
        .eq('id', sessionId);
}

/**
 * Evaluate answer for a question
 */
export function evaluateAnswer(
    question: Question,
    userAnswer: any
): { isCorrect: boolean; pointsEarned: number } {
    let isCorrect = false;

    switch (question.questionType) {
        case 'mcq':
        case 'true_false':
            isCorrect = userAnswer === question.correctAnswers[0];
            break;

        case 'multiple_correct':
            const userAnswers = Array.isArray(userAnswer) ? userAnswer : [];
            const correctAnswers = question.correctAnswers;
            isCorrect =
                userAnswers.length === correctAnswers.length &&
                userAnswers.every(a => correctAnswers.includes(a));
            break;

        case 'integer':
            isCorrect = parseInt(userAnswer) === parseInt(question.correctAnswers[0]);
            break;

        case 'assertion_reason':
        case 'match_column':
        case 'statement_based':
            // These require custom logic based on how answers are structured
            isCorrect = JSON.stringify(userAnswer) === JSON.stringify(question.correctAnswers[0]);
            break;

        default:
            isCorrect = false;
    }

    // Calculate points
    const pointsEarned = isCorrect
        ? question.points
        : -(question.negativePoints || 0);

    return { isCorrect, pointsEarned };
}

/**
 * Submit test and calculate results
 */
export async function submitTest(
    sessionId: string,
    userId: string
): Promise<{
    totalQuestions: number;
    attempted: number;
    correct: number;
    incorrect: number;
    totalPoints: number;
    results: AttemptResult[];
}> {
    const supabase = createClient();

    // Get session
    const session = await getTestSession(sessionId);
    if (!session) {
        throw new Error('Session not found');
    }

    // Fetch all questions
    const { data: questions } = await supabase
        .from('questions')
        .select('*')
        .in('id', session.questions);

    if (!questions) {
        throw new Error('Questions not found');
    }

    const results: AttemptResult[] = [];
    let totalPoints = 0;
    let correct = 0;
    let incorrect = 0;
    let attempted = 0;

    // Evaluate each question
    for (const question of questions) {
        const userAnswer = session.answers[question.id];

        if (userAnswer !== undefined && userAnswer !== null) {
            attempted++;

            const { isCorrect, pointsEarned } = evaluateAnswer(question, userAnswer);

            if (isCorrect) {
                correct++;
            } else {
                incorrect++;
            }

            totalPoints += pointsEarned;

            // Store in user_attempts
            await supabase.from('user_attempts').insert({
                user_id: userId,
                question_id: question.id,
                session_id: sessionId,
                status: 'completed',
                user_answer: userAnswer,
                is_correct: isCorrect,
                points_earned: pointsEarned,
                time_taken_seconds: Math.floor(session.duration / questions.length), // Approximate
                started_at: session.startedAt.toISOString(),
                completed_at: new Date().toISOString(),
            });

            results.push({
                questionId: question.id,
                userAnswer,
                isCorrect,
                pointsEarned,
                timeTaken: 0,
            });
        }
    }

    // Mark session as completed
    await supabase
        .from('test_sessions')
        .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

    return {
        totalQuestions: questions.length,
        attempted,
        correct,
        incorrect,
        totalPoints,
        results,
    };
}
