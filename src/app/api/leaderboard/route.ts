import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboard } from '@/features/mock/services/mock-test.service';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const limit = parseInt(searchParams.get('limit') || '100');
        const offset = parseInt(searchParams.get('offset') || '0');

        const leaderboard = await getLeaderboard(limit, offset);

        // Check cache age
        const supabase = createClient();
        const { data: cacheInfo } = await supabase
            .from('leaderboard_cache')
            .select('cached_at')
            .limit(1)
            .single();

        const cacheAge = cacheInfo?.cached_at
            ? Math.floor((Date.now() - new Date(cacheInfo.cached_at).getTime()) / 1000)
            : null;

        return NextResponse.json({
            success: true,
            leaderboard,
            cacheAge,
            lastUpdated: cacheInfo?.cached_at,
        });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return NextResponse.json(
            { error: 'Failed to fetch leaderboard' },
            { status: 500 }
        );
    }
}
