import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getUserRank } from '@/features/mock/services/mock-test.service';

export async function GET(request: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const rank = await getUserRank(user.id);

        if (!rank) {
            return NextResponse.json({
                success: true,
                rank: null,
                message: 'Complete mock tests or practice to get ranked',
            });
        }

        return NextResponse.json({
            success: true,
            rank,
        });
    } catch (error) {
        console.error('Error fetching user rank:', error);
        return NextResponse.json(
            { error: 'Failed to fetch rank' },
            { status: 500 }
        );
    }
}
