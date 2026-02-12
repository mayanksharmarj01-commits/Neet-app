import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { updateSessionAnswers } from '@/features/mock/services/question-engine.service';

export async function POST(
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

        const { questionId, answer } = await request.json();

        if (!questionId) {
            return NextResponse.json(
                { error: 'Question ID is required' },
                { status: 400 }
            );
        }

        // Update session answers
        await updateSessionAnswers(params.sessionId, questionId, answer);

        return NextResponse.json({
            success: true,
            message: 'Answer saved',
        });
    } catch (error) {
        console.error('Error saving answer:', error);
        return NextResponse.json(
            { error: 'Failed to save answer' },
            { status: 500 }
        );
    }
}
