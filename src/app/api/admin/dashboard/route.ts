import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdmin, getDashboardStats } from '@/features/admin/services/admin.service';

export const dynamic = 'force-dynamic';

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

        // Check admin permission
        const hasAdminAccess = await isAdmin(user.id);
        if (!hasAdminAccess) {
            return NextResponse.json(
                { error: 'Forbidden - Admin access required' },
                { status: 403 }
            );
        }

        // Get date range from query params
        const searchParams = request.nextUrl.searchParams;
        const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
        const startDate =
            searchParams.get('startDate') ||
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const stats = await getDashboardStats(startDate, endDate);

        if (!stats) {
            return NextResponse.json(
                { error: 'Failed to fetch dashboard stats' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            stats,
            dateRange: {
                startDate,
                endDate,
            },
        });
    } catch (error: any) {
        console.error('Dashboard stats error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
