import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * Cron job to refresh leaderboard cache every 5 minutes
 * Configure in vercel.json or use Supabase Edge Functions
 * 
 * Vercel Cron: https://vercel.com/docs/cron-jobs
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/refresh-leaderboard",
 *     "schedule": "0/5 * * * *"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
    try {
        // Verify cron secret (security)
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role for admin access
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                },
            }
        );

        // Call the refresh function
        const { error } = await supabase.rpc('refresh_leaderboard_cache');

        if (error) {
            console.error('Error refreshing leaderboard:', error);
            return NextResponse.json(
                { error: 'Failed to refresh leaderboard', details: error.message },
                { status: 500 }
            );
        }

        console.log('Leaderboard cache refreshed successfully at', new Date().toISOString());

        return NextResponse.json({
            success: true,
            message: 'Leaderboard cache refreshed',
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Cron job error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
