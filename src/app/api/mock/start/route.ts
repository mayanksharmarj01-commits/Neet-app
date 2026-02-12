import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { startMockTest } from '@/features/mock/services/mock-test.service';

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

        const { mockTestId } = await request.json();

        if (!mockTestId) {
            return NextResponse.json(
                { error: 'Mock test ID is required' },
                { status: 400 }
            );
        }

        const result = await startMockTest(user.id, mockTestId);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 403 }
            );
        }

        return NextResponse.json({
            success: true,
            sessionId: result.sessionId,
        });
    } catch (error) {
        console.error('Error starting mock test:', error);
        return NextResponse.json(
            { error: 'Failed to start mock test' },
            { status: 500 }
        );
    }
}
