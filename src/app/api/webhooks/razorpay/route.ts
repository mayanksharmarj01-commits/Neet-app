import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyWebhookSignature } from '@/lib/razorpay/razorpay.service';
import { activateSubscription, recordPaymentTransaction } from '@/features/subscription/services/subscription.service';

export const runtime = 'edge';

/**
 * Razorpay Webhook Handler
 * CRITICAL: Signature verification for security
 */
export async function POST(request: NextRequest) {
    try {
        // Get raw body for signature verification
        const rawBody = await request.text();
        const signature = request.headers.get('x-razorpay-signature') || '';

        // CRITICAL: Verify webhook signature
        const isValid = verifyWebhookSignature(
            rawBody,
            signature,
            process.env.RAZORPAY_WEBHOOK_SECRET || ''
        );

        if (!isValid) {
            console.error('❌ Invalid webhook signature');
            return NextResponse.json(
                { error: 'Invalid signature' },
                { status: 401 }
            );
        }

        console.log('✅ Webhook signature verified');

        // Parse webhook payload
        const payload = JSON.parse(rawBody);
        const event = payload.event;
        const paymentEntity = payload.payload?.payment?.entity;

        console.log('Webhook event:', event);

        // Handle different webhook events
        switch (event) {
            case 'payment.captured':
                await handlePaymentCaptured(paymentEntity, payload);
                break;

            case 'payment.failed':
                await handlePaymentFailed(paymentEntity, payload);
                break;

            case 'refund.created':
                await handleRefundRequest(paymentEntity, payload);
                break;

            default:
                console.log('Unhandled webhook event:', event);
        }

        return NextResponse.json({ success: true, received: true });
    } catch (error: any) {
        console.error('Webhook error:', error);
        return NextResponse.json(
            { error: 'Webhook processing failed' },
            { status: 500 }
        );
    }
}

/**
 * Handle successful payment
 */
async function handlePaymentCaptured(paymentEntity: any, webhookPayload: any) {
    try {
        const supabase = createClient();

        const paymentId = paymentEntity.id;
        const orderId = paymentEntity.order_id;
        const amount = paymentEntity.amount;
        const notes = paymentEntity.notes || {};

        console.log('Processing payment:', paymentId);

        // Get subscription from notes
        const userId = notes.user_id;
        const planId = notes.plan_id;

        if (!userId || !planId) {
            console.error('Missing user_id or plan_id in payment notes');
            return;
        }

        // Find pending subscription
        const { data: subscription } = await supabase
            .from('user_subscriptions')
            .select('id')
            .eq('user_id', userId)
            .eq('plan_id', planId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!subscription) {
            console.error('No pending subscription found');
            return;
        }

        // Activate subscription
        const activated = await activateSubscription(subscription.id, {
            razorpayPaymentId: paymentId,
            razorpayOrderId: orderId,
            razorpaySignature: '', // From webhook, no signature
            amountPaid: amount,
        });

        if (!activated) {
            console.error('Failed to activate subscription');
            return;
        }

        // Record transaction
        await recordPaymentTransaction({
            userId,
            subscriptionId: subscription.id,
            amount,
            razorpayPaymentId: paymentId,
            razorpayOrderId: orderId,
            paymentLink: '',
            status: 'success',
            webhookPayload: webhookPayload,
            signatureVerified: true,
        });

        console.log('✅ Subscription activated:', subscription.id);

        // TODO: Send confirmation email
    } catch (error) {
        console.error('Error handling payment captured:', error);
    }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(paymentEntity: any, webhookPayload: any) {
    try {
        const supabase = createClient();

        const paymentId = paymentEntity.id;
        const notes = paymentEntity.notes || {};
        const userId = notes.user_id;

        console.log('Payment failed:', paymentId);

        if (!userId) return;

        // Find pending subscription
        const { data: subscription } = await supabase
            .from('user_subscriptions')
            .select('id, payment_retry_count')
            .eq('user_id', userId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!subscription) return;

        // Increment retry count
        const retryCount = subscription.payment_retry_count + 1;

        if (retryCount >= 3) {
            // Exceeded retry limit, mark as failed
            await supabase
                .from('user_subscriptions')
                .update({
                    status: 'failed',
                    payment_retry_count: retryCount,
                })
                .eq('id', subscription.id);

            console.log('❌ Subscription failed after 3 retries');
        } else {
            // Schedule retry
            const nextRetry = new Date();
            nextRetry.setHours(nextRetry.getHours() + 24);

            await supabase
                .from('user_subscriptions')
                .update({
                    payment_retry_count: retryCount,
                    last_retry_at: new Date().toISOString(),
                    next_retry_at: nextRetry.toISOString(),
                })
                .eq('id', subscription.id);

            console.log(`⏳ Retry scheduled (${retryCount}/3)`);
        }

        // Record failed transaction
        await recordPaymentTransaction({
            userId,
            subscriptionId: subscription.id,
            amount: paymentEntity.amount,
            razorpayPaymentId: paymentId,
            paymentLink: '',
            status: 'failed',
            webhookPayload: webhookPayload,
            signatureVerified: true,
        });

        // TODO: Send retry notification email
    } catch (error) {
        console.error('Error handling payment failed:', error);
    }
}

/**
 * Handle refund request - REJECT (no refunds policy)
 */
async function handleRefundRequest(paymentEntity: any, webhookPayload: any) {
    try {
        const supabase = createClient();

        const paymentId = paymentEntity.id;
        const refundAmount = paymentEntity.amount;

        console.log('⚠️ Refund attempted:', paymentId);

        // Find transaction
        const { data: transaction } = await supabase
            .from('payment_transactions')
            .select('*')
            .eq('razorpay_payment_id', paymentId)
            .single();

        if (!transaction) return;

        // Mark refund as rejected
        await supabase
            .from('payment_transactions')
            .update({
                refund_requested: true,
                refund_rejected_at: new Date().toISOString(),
                refund_rejection_reason: 'No refunds as per subscription policy',
                status: 'refund_rejected',
            })
            .eq('id', transaction.id);

        console.log('❌ Refund rejected (no refund policy)');

        // TODO: Send automated email explaining no-refund policy
        // TODO: Notify admin for review
    } catch (error) {
        console.error('Error handling refund request:', error);
    }
}
