import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createTestSession, fetchQuestions } from '@/features/mock/services/question-engine.service';

export async function POST(request: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { difficulty, topics, tags, limit, durationMinutes } = await request.json();

        // Fetch questions based on filters
        const questions = await fetchQuestions({
            difficulty,
            topics,
            tags,
            limit: limit || 50,
        });

        if (questions.length === 0) {
            return NextResponse.json(
                { error: 'No questions found matching criteria' },
                { status: 404 }
            );
        }

        // Create test session
        const sessionId = await createTestSession(
            user.id,
            questions,
            durationMinutes || 180
        );

        return NextResponse.json({
            success: true,
            sessionId,
            questionCount: questions.length,
            duration: durationMinutes || 180,
        });
    } catch (error) {
        console.error('Error starting test:', error);
        return NextResponse.json(
            { error: 'Failed to start test' },
            { status: 500 }
        );
    }
}
