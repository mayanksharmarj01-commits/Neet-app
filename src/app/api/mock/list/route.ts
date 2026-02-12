import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { fetchMockTests } from '@/features/mock/services/mock-test.service';

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

        const searchParams = request.nextUrl.searchParams;
        const mockType = searchParams.get('mockType') || undefined;
        const subjectId = searchParams.get('subjectId') || undefined;
        const difficulty = searchParams.get('difficulty') || undefined;

        const mocks = await fetchMockTests({
            mockType,
            subjectId,
            difficulty,
        });

        return NextResponse.json({
            success: true,
            mocks,
        });
    } catch (error) {
        console.error('Error fetching mock tests:', error);
        return NextResponse.json(
            { error: 'Failed to fetch mock tests' },
            { status: 500 }
        );
    }
}
