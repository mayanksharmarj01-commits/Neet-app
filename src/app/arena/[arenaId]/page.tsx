import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ArenaRoom } from '@/features/arena/components/arena-room';

export default async function ArenaPage({ params }: { params: Promise<{ arenaId: string }> }) {
    const { arenaId } = await params;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/auth/login');
    }

    // Fetch arena details
    const { data: arena } = await supabase
        .from('arenas')
        .select('*')
        .eq('id', arenaId)
        .single();

    if (!arena) {
        redirect('/arena');
    }

    // Check if user is participant
    const { data: participant } = await supabase
        .from('arena_participants')
        .select('*')
        .eq('arena_id', arenaId)
        .eq('user_id', user.id)
        .single();

    if (!participant) {
        // Auto-join if arena not full
        if (arena.participant_count < arena.max_participants) {
            await supabase
                .from('arena_participants')
                .insert({
                    arena_id: arenaId,
                    user_id: user.id,
                    is_host: false,
                });
        } else {
            redirect('/arena');
        }
    }

    return <ArenaRoom arenaId={arenaId} />;
}
