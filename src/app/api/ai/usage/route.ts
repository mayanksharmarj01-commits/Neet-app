import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserTokenStats } from '@/features/ai/services/ai-management.service';

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

        const stats = await getUserTokenStats(user.id);

        if (!stats) {
            return NextResponse.json({
                success: true,
                stats: {
                    tokensUsedToday: 0,
                    tokensRemainingToday: 10000,
                    dailyLimit: 10000,
                    requestsToday: 0,
                    estimatedCostToday: 0,
                },
            });
        }

        return NextResponse.json({
            success: true,
            stats,
        });
    } catch (error) {
        console.error('Error fetching AI usage:', error);
        return NextResponse.json(
            { error: 'Failed to fetch usage statistics' },
            { status: 500 }
        );
    }
}
