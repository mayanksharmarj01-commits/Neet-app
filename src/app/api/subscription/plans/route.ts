import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSubscriptionPlans } from '@/features/subscription/services/subscription.service';

export async function GET(request: NextRequest) {
    try {
        const plans = await getSubscriptionPlans();

        return NextResponse.json({
            success: true,
            plans,
        });
    } catch (error) {
        console.error('Error fetching plans:', error);
        return NextResponse.json(
            { error: 'Failed to fetch plans' },
            { status: 500 }
        );
    }
}
