import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { submitTest } from '@/features/mock/services/question-engine.service';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const { sessionId } = await params;
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Submit test and calculate results
        const results = await submitTest(sessionId, user.id);

        // Update user total points (fetch first to avoid raw SQL usage)
        const { data: userData } = await supabase
            .from('users')
            .select('total_points')
            .eq('id', user.id)
            .single();

        const currentPoints = userData?.total_points || 0;

        await supabase
            .from('users')
            .update({
                total_points: currentPoints + results.totalPoints,
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
