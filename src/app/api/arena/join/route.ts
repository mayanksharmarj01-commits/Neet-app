import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { joinArenaByCode } from '@/features/arena/services/arena.service';

export async function POST(request: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { roomCode } = await request.json();

        if (!roomCode) {
            return NextResponse.json(
                { error: 'Room code is required' },
                { status: 400 }
            );
        }

        const result = await joinArenaByCode(user.id, roomCode);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            arenaId: result.arenaId,
        });
    } catch (error) {
        console.error('Error joining arena:', error);
        return NextResponse.json(
            { error: 'Failed to join arena' },
            { status: 500 }
        );
    }
}
