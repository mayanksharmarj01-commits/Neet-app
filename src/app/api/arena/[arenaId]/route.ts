
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ arenaId: string }> }
) {
    const supabase = await createClient();
    const { arenaId } = await params;

    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Fetch Arena Details
        const { data: arena, error: arenaError } = await supabase
            .from('arenas')
            .select(`
                *,
                created_by_user:users!created_by(full_name, email)
            `)
            .eq('id', arenaId)
            .single();

        if (arenaError || !arena) {
            return NextResponse.json({ error: 'Arena not found' }, { status: 404 });
        }

        // 2. Check Participation
        const { data: participant, error: participantError } = await supabase
            .from('arena_participants')
            .select('*')
            .eq('arena_id', arenaId)
            .eq('user_id', user.id)
            .single();

        // 3. Fetch Questions (only if participant and live/completed, or host)
        let questions = [];
        if (participant || arena.created_by === user.id) {
            // Fetch questions linked to this arena
            // Currently arenas table might have question_ids array or a junction table?
            // Let's check schema. Usually mock tests have questions. 
            // Does arena have question_ids?
            // If not, we need to know how questions are linked.
            // Checking 004_arena_system.sql would clarify.
            // Assuming arena has question_ids[] based on typical design or a separate table.

            if (arena.question_ids && arena.question_ids.length > 0) {
                const { data: questionsData } = await supabase
                    .from('questions')
                    .select('*')
                    .in('id', arena.question_ids);

                questions = questionsData || [];
            }
        }

        return NextResponse.json({
            success: true,
            arena: {
                ...arena,
                questions: questions, // Include questions
                is_participant: !!participant,
                is_host: arena.created_by === user.id
            }
        });

    } catch (error: any) {
        console.error('Error fetching arena:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
