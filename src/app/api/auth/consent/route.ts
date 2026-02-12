import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { recordConsent, getDeviceInfo } from '@/features/auth/services/auth.service';

export async function POST(request: NextRequest) {
    try {
        const { userId, acceptTerms, ageConfirmation } = await request.json();

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            );
        }

        const deviceInfo = await getDeviceInfo();
        const supabase = createClient();

        // Verify user owns this session
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || user.id !== userId) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Record consents
        if (acceptTerms) {
            await recordConsent(
                userId,
                'terms_and_conditions',
                '1.0',
                deviceInfo.ipAddress,
                deviceInfo.userAgent
            );
        }

        if (ageConfirmation) {
            await recordConsent(
                userId,
                'age_declaration',
                '1.0',
                deviceInfo.ipAddress,
                deviceInfo.userAgent,
                { age_confirmed: true, minimum_age: 18 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Consents recorded successfully',
        });
    } catch (error) {
        console.error('Consent recording error:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
