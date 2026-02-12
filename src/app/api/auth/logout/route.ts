import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { deactivateSession, getDeviceInfo } from '@/features/auth/services/auth.service';

export async function POST(request: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
            // Deactivate session in database
            await deactivateSession(session.access_token);
        }

        // Sign out from Supabase
        await supabase.auth.signOut();

        return NextResponse.json({
            success: true,
            message: 'Logged out successfully',
        });
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
