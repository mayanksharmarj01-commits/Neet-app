import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getArenaLeaderboard } from '@/features/arena/services/arena.service';

export async function GET(
    request: NextRequest,
    { params }: { params: { arenaId: string } }
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

        const leaderboard = await getArenaLeaderboard(params.arenaId, user.id);

        if (leaderboard === null) {
            return NextResponse.json({
                success: false,
                message: 'Leaderboard is not available. Submit your answers first or leaderboard is hidden after viewing solutions.',
                leaderboard: [],
            });
        }

        return NextResponse.json({
            success: true,
            leaderboard,
        });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return NextResponse.json(
            { error: 'Failed to fetch leaderboard' },
            { status: 500 }
        );
    }
}
