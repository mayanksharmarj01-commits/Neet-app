import { NextRequest, NextResponse } from 'next/server';
import { incrementTabSwitch } from '@/features/mock/services/question-engine.service';

export async function POST(
    request: NextRequest,
    { params }: { params: { sessionId: string } }
) {
    try {
        await incrementTabSwitch(params.sessionId);

        return NextResponse.json({
            success: true,
            message: 'Tab switch recorded',
        });
    } catch (error) {
        console.error('Error tracking tab switch:', error);
        return NextResponse.json(
            { error: 'Failed to track tab switch' },
            { status: 500 }
        );
    }
}
