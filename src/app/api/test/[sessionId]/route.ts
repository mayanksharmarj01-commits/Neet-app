import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getTestSession, getRemainingTime } from '@/features/mock/services/question-engine.service';

export async function GET(
    request: NextRequest,
    { params }: { params: { sessionId: string } }
) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const session = await getTestSession(params.sessionId);

        if (!session) {
            return NextResponse.json(
                { error: 'Session not found' },
                { status: 404 }
            );
        }

        if (session.userId !== user.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 403 }
            );
        }

        // Fetch questions
        const { data: questions } = await supabase
            .from('questions')
            .select('*')
            .in('id', session.questions);

        // Calculate remaining time
        const remainingTime = getRemainingTime(session);

        return NextResponse.json({
            success: true,
            session: {
                id: session.id,
                startedAt: session.startedAt,
                duration: session.duration,
                currentQuestionIndex: session.currentQuestionIndex,
                answers: session.answers,
                markedForReview: session.markedForReview,
                tabSwitchCount: session.tabSwitchCount,
                remainingTime,
            },
            questions,
        });
    } catch (error) {
        console.error('Error fetching session:', error);
        return NextResponse.json(
            { error: 'Failed to fetch session' },
            { status: 500 }
        );
    }
}
