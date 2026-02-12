import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { submitTest } from '@/features/mock/services/question-engine.service';

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

        // Submit test and calculate results
        const results = await submitTest(params.sessionId, user.id);

        // Update user total points
        await supabase
            .from('users')
            .update({
                total_points: supabase.raw(`total_points + ${results.totalPoints}`),
            })
            .eq('id', user.id);

        return NextResponse.json({
            success: true,
            results,
        });
    } catch (error) {
        console.error('Error submitting test:', error);
        return NextResponse.json(
            { error: 'Failed to submit test' },
            { status: 500 }
        );
    }
}
