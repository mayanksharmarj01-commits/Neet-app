import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { submitArenaAnswers } from '@/features/arena/services/arena.service';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ arenaId: string }> }
) {
    try {
        const { arenaId } = await params;
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { answers, timeTakenSeconds } = await request.json();

        const result = await submitArenaAnswers(
            arenaId,
            user.id,
            answers,
            timeTakenSeconds
        );

        if (!result.success) {
            return NextResponse.json(
                { error: 'Failed to submit answers' },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            score: result.score,
            rank: result.rank,
        });
    } catch (error) {
        console.error('Error submitting arena answers:', error);
        return NextResponse.json(
            { error: 'Failed to submit answers' },
            { status: 500 }
        );
    }
}
