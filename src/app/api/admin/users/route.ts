import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdmin, getUsers, banUser, unbanUser } from '@/features/admin/services/admin.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user || !(await isAdmin(user.id))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search') || undefined;
        const status = searchParams.get('status') || undefined;

        const result = await getUsers({ page, limit, search, status });

        return NextResponse.json({
            success: true,
            users: result.users,
            total: result.total,
            page,
            limit,
            totalPages: Math.ceil(result.total / limit),
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user || !(await isAdmin(user.id))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { action, userId, reason, isPermanent, unbanAt } = body;

        if (action === 'ban') {
            const result = await banUser({
                userId,
                bannedBy: user.id,
                reason,
                isPermanent,
                unbanAt,
            });

            if (!result.success) {
                return NextResponse.json(
                    { error: result.error },
                    { status: 400 }
                );
            }

            return NextResponse.json({
                success: true,
                message: 'User banned successfully',
            });
        } else if (action === 'unban') {
            const result = await unbanUser(userId);

            if (!result.success) {
                return NextResponse.json(
                    { error: result.error },
                    { status: 400 }
                );
            }

            return NextResponse.json({
                success: true,
                message: 'User unbanned successfully',
            });
        } else {
            return NextResponse.json(
                { error: 'Invalid action' },
                { status: 400 }
            );
        }
    } catch (error) {
        console.error('Error managing user:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
