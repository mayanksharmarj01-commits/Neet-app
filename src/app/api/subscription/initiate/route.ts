import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generatePaymentLink } from '@/lib/razorpay/razorpay.service';
import { createPendingSubscription, recordPaymentTransaction } from '@/features/subscription/services/subscription.service';

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

        const { planId } = await request.json();

        if (!planId) {
            return NextResponse.json(
                { error: 'Plan ID is required' },
                { status: 400 }
            );
        }

        // Get plan details
        const { data: plan } = await supabase
            .from('subscription_plans')
            .select('*')
            .eq('id', planId)
            .eq('is_active', true)
            .single();

        if (!plan) {
            return NextResponse.json(
                { error: 'Invalid plan' },
                { status: 404 }
            );
        }

        // Get user details
        const { data: userData } = await supabase
            .from('users')
            .select('email, full_name')
            .eq('id', user.id)
            .single();

        if (!userData) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Create pending subscription
        const subscription = await createPendingSubscription(
            user.id,
            planId,
            plan.duration_days
        );

        if (!subscription.success) {
            return NextResponse.json(
                { error: subscription.error },
                { status: 500 }
            );
        }

        // Generate payment link
        const payment = await generatePaymentLink({
            userId: user.id,
            userEmail: userData.email,
            userName: userData.full_name || 'User',
            planId,
            amount: plan.price_inr,
            description: `Subscription: ${plan.name}`,
        });

        if (!payment.success) {
            return NextResponse.json(
                { error: payment.error },
                { status: 500 }
            );
        }

        // Record transaction
        await recordPaymentTransaction({
            userId: user.id,
            subscriptionId: subscription.subscriptionId!,
            amount: plan.price_inr,
            razorpayOrderId: payment.orderId,
            paymentLink: payment.paymentLink!,
            status: 'pending',
        });

        return NextResponse.json({
            success: true,
            paymentLink: payment.paymentLink,
            orderId: payment.orderId,
            subscriptionId: subscription.subscriptionId,
        });
    } catch (error: any) {
        console.error('Error initiating payment:', error);
        return NextResponse.json(
            { error: 'Failed to initiate payment' },
            { status: 500 }
        );
    }
}
