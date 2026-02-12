import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createArena } from '@/features/arena/services/arena.service';

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

        const body = await request.json();
        const {
            title,
            description,
            isPublic,
            maxParticipants,
            scheduledStartTime,
            durationMinutes,
            questionFilters,
            totalQuestions,
        } = body;

        // Validate required fields
        if (!title || !scheduledStartTime || !totalQuestions) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const result = await createArena(user.id, {
            title,
            description,
            isPublic: isPublic !== false, // Default to public
            maxParticipants: Math.min(maxParticipants || 50, 50),
            scheduledStartTime,
            durationMinutes: durationMinutes || 60,
            questionFilters: questionFilters || {},
            totalQuestions,
        });

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            arenaId: result.arenaId,
            roomCode: result.roomCode,
        });
    } catch (error) {
        console.error('Error creating arena:', error);
        return NextResponse.json(
            { error: 'Failed to create arena' },
            { status: 500 }
        );
    }
}
