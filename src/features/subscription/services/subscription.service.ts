import { createClient } from '@/lib/supabase/server';

export interface SubscriptionPlan {
    id: string;
    name: string;
    description: string;
    priceInr: number; // In paise
    durationDays: number;
    features: any;
}

export interface UserSubscription {
    id: string;
    userId: string;
    planId: string;
    status: 'pending' | 'active' | 'expired' | 'cancelled' | 'failed';
    startedAt?: string;
    expiresAt?: string;
    paymentRetryCount: number;
    razorpayPaymentId?: string;
}

/**
 * Get all active subscription plans
 */
export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    const supabase = createClient();

    const { data } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    return data || [];
}

/**
 * Get user's active subscription
 */
export async function getUserActiveSubscription(userId: string): Promise<{
    hasActive: boolean;
    subscription?: any;
    daysRemaining?: number;
}> {
    const supabase = createClient();

    const { data } = await supabase
        .rpc('get_active_subscription', { p_user_id: userId });

    if (data && data.length > 0) {
        return {
            hasActive: true,
            subscription: data[0],
            daysRemaining: data[0].days_remaining,
        };
    }

    return { hasActive: false };
}

/**
 * Check if user has active subscription (for paywall)
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
    const supabase = createClient();

    const { data } = await supabase
        .rpc('has_active_subscription', { p_user_id: userId });

    return data === true;
}

/**
 * Create pending subscription (before payment)
 */
export async function createPendingSubscription(
    userId: string,
    planId: string,
    durationDays: number
): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
    const supabase = createClient();

    // Check for existing pending subscription
    const { data: existing } = await supabase
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .single();

    if (existing) {
        return {
            success: true,
            subscriptionId: existing.id,
        };
    }

    // Create new pending subscription
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    const { data, error } = await supabase
        .from('user_subscriptions')
        .insert({
            user_id: userId,
            plan_id: planId,
            status: 'pending',
            expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

    if (error) {
        return { success: false, error: error.message };
    }

    return {
        success: true,
        subscriptionId: data.id,
    };
}

/**
 * Activate subscription after successful payment
 */
export async function activateSubscription(
    subscriptionId: string,
    paymentDetails: {
        razorpayPaymentId: string;
        razorpayOrderId: string;
        razorpaySignature: string;
        amountPaid: number;
    }
): Promise<boolean> {
    const supabase = createClient();

    const { error } = await supabase
        .from('user_subscriptions')
        .update({
            status: 'active',
            started_at: new Date().toISOString(),
            razorpay_payment_id: paymentDetails.razorpayPaymentId,
            razorpay_order_id: paymentDetails.razorpayOrderId,
            razorpay_signature: paymentDetails.razorpaySignature,
            amount_paid: paymentDetails.amountPaid,
            payment_retry_count: 0,
        })
        .eq('id', subscriptionId);

    if (error) {
        console.error('Error activating subscription:', error);
        return false;
    }

    // Update user's subscription_status
    const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('user_id')
        .eq('id', subscriptionId)
        .single();

    if (subscription) {
        await supabase
            .from('users')
            .update({ subscription_status: 'active' })
            .eq('id', subscription.user_id);
    }

    return true;
}

/**
 * Record payment transaction
 */
export async function recordPaymentTransaction(params: {
    userId: string;
    subscriptionId: string;
    amount: number;
    razorpayPaymentId?: string;
    razorpayOrderId?: string;
    razorpaySignature?: string;
    paymentLink: string;
    status: 'pending' | 'success' | 'failed';
    webhookPayload?: any;
    signatureVerified?: boolean;
}): Promise<string | null> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('payment_transactions')
        .insert({
            user_id: params.userId,
            subscription_id: params.subscriptionId,
            transaction_type: 'subscription',
            status: params.status,
            amount: params.amount,
            razorpay_payment_id: params.razorpayPaymentId,
            razorpay_order_id: params.razorpayOrderId,
            razorpay_signature: params.razorpaySignature,
            payment_link: params.paymentLink,
            webhook_payload: params.webhookPayload,
            signature_verified: params.signatureVerified,
            webhook_received_at: params.webhookPayload ? new Date().toISOString() : null,
        })
        .select('id')
        .single();

    if (error) {
        console.error('Error recording transaction:', error);
        return null;
    }

    return data.id;
}

/**
 * Retry payment (max 3 attempts)
 */
export async function retryPayment(subscriptionId: string): Promise<{
    canRetry: boolean;
    attemptsLeft: number;
}> {
    const supabase = createClient();

    const { data } = await supabase
        .rpc('retry_failed_payment', { p_subscription_id: subscriptionId });

    if (!data) {
        return { canRetry: false, attemptsLeft: 0 };
    }

    // Get updated retry count
    const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('payment_retry_count')
        .eq('id', subscriptionId)
        .single();

    const attemptsLeft = 3 - (subscription?.payment_retry_count || 0);

    return {
        canRetry: attemptsLeft > 0,
        attemptsLeft,
    };
}

/**
 * Get subscriptions needing reminders
 */
export async function getSubscriptionsNeedingReminders(): Promise<any[]> {
    const supabase = createClient();

    const { data } = await supabase
        .rpc('get_subscriptions_needing_reminders');

    return data || [];
}

/**
 * Record reminder sent
 */
export async function recordReminderSent(
    subscriptionId: string,
    userId: string,
    reminderType: '7_days' | '3_days' | '1_day' | 'expired'
): Promise<void> {
    const supabase = createClient();

    await supabase
        .from('subscription_reminders')
        .insert({
            subscription_id: subscriptionId,
            user_id: userId,
            reminder_type: reminderType,
        });
}

/**
 * Process expired subscriptions
 */
export async function processExpiredSubscriptions(): Promise<number> {
    const supabase = createClient();

    const { data } = await supabase
        .rpc('process_expired_subscriptions');

    return data || 0;
}

/**
 * Get pending transactions for admin review
 */
export async function getPendingTransactions(): Promise<any[]> {
    const supabase = createClient();

    const { data } = await supabase
        .from('payment_transactions')
        .select(`
            *,
            users (
                email,
                full_name
            ),
            user_subscriptions (
                id,
                status
            )
        `)
        .eq('manually_verified', false)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    return data || [];
}

/**
 * Manually verify payment (Admin only)
 */
export async function manuallyVerifyPayment(
    transactionId: string,
    adminId: string,
    notes: string
): Promise<boolean> {
    const supabase = createClient();

    // Update transaction
    const { data: transaction, error: txError } = await supabase
        .from('payment_transactions')
        .update({
            manually_verified: true,
            verified_by: adminId,
            verified_at: new Date().toISOString(),
            verification_notes: notes,
            status: 'success',
        })
        .eq('id', transactionId)
        .select()
        .single();

    if (txError || !transaction) {
        return false;
    }

    // Activate associated subscription
    if (transaction.subscription_id) {
        await supabase
            .from('user_subscriptions')
            .update({
                status: 'active',
                started_at: new Date().toISOString(),
            })
            .eq('id', transaction.subscription_id);

        // Update user status
        await supabase
            .from('users')
            .update({ subscription_status: 'active' })
            .eq('id', transaction.user_id);
    }

    return true;
}
