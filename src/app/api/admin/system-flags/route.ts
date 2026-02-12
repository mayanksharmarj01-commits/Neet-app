import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdmin, getSystemFlags, updateSystemFlag } from '@/features/admin/services/admin.service';

export async function GET(request: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user || !(await isAdmin(user.id))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const result = await getSystemFlags();

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            flags: result.flags,
        });
    } catch (error) {
        console.error('Error fetching system flags:', error);
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
        const { flagName, flagValue } = body;

        if (!flagName || typeof flagValue !== 'boolean') {
            return NextResponse.json(
                { error: 'Invalid request body' },
                { status: 400 }
            );
        }

        const result = await updateSystemFlag({
            flagName,
            flagValue,
            updatedBy: user.id,
        });

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'System flag updated successfully',
        });
    } catch (error) {
        console.error('Error updating system flag:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
