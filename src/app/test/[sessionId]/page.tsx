import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { TestInterface } from '@/features/mock/components/test-interface';

export default async function TestPage({ params }: { params: { sessionId: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/auth/login');
    }

    // Fetch session data
    const { data: session, error: sessionError } = await supabase
        .from('test_sessions')
        .select('*')
        .eq('id', params.sessionId)
        .single();

    if (sessionError || !session) {
        redirect('/mock');
    }

    // Verify user owns this session
    if (session.user_id !== user.id) {
        redirect('/mock');
    }

    // Check if already completed
    if (session.status === 'completed') {
        redirect(`/test/${params.sessionId}/results`);
    }

    // Fetch questions
    const { data: questions } = await supabase
        .from('questions')
        .select('*')
        .in('id', session.question_ids);

    // Calculate remaining time
    const elapsed = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000);
    const remainingTime = Math.max(0, session.duration_seconds - elapsed);

    // If time expired, redirect to results
    if (remainingTime === 0) {
        redirect(`/test/${params.sessionId}/results`);
    }

    return (
        <TestInterface
            sessionId={params.sessionId}
            initialQuestions={questions || []}
            initialSession={{
                answers: session.answers || {},
                markedForReview: session.marked_for_review || [],
                tabSwitchCount: session.tab_switch_count || 0,
                remainingTime,
            }}
        />
    );
}
