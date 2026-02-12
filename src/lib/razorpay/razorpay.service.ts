import Razorpay from 'razorpay';
import crypto from 'crypto';

/**
 * Razorpay Service for Manual Subscription
 * Production-ready with signature verification
 */

// Initialize Razorpay instance
const getRazorpayInstance = () => {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new Error('Razorpay credentials not configured');
    }

    return new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
};

/**
 * Generate payment link for subscription
 */
export async function generatePaymentLink(params: {
    userId: string;
    userEmail: string;
    userName: string;
    planId: string;
    amount: number; // In paise
    description: string;
}): Promise<{
    success: boolean;
    paymentLink?: string;
    orderId?: string;
    error?: string;
}> {
    try {
        const razorpay = getRazorpayInstance();

        // Create Razorpay order
        const order = await razorpay.orders.create({
            amount: params.amount,
            currency: 'INR',
            receipt: `sub_${params.userId}_${Date.now()}`,
            notes: {
                user_id: params.userId,
                plan_id: params.planId,
                subscription: 'true',
            },
        });

        // Create payment link
        const paymentLink = await razorpay.paymentLink.create({
            amount: params.amount,
            currency: 'INR',
            description: params.description,
            customer: {
                email: params.userEmail,
                name: params.userName,
            },
            notify: {
                email: true,
            },
            reminder_enable: true,
            notes: {
                user_id: params.userId,
                plan_id: params.planId,
                order_id: order.id,
            },
            callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription/verify`,
            callback_method: 'get',
        });

        return {
            success: true,
            paymentLink: paymentLink.short_url,
            orderId: order.id,
        };
    } catch (error: any) {
        console.error('Error generating payment link:', error);
        return {
            success: false,
            error: error.message || 'Failed to generate payment link',
        };
    }
}

/**
 * Verify webhook signature (Critical for security)
 */
export function verifyWebhookSignature(
    webhookBody: string,
    signature: string,
    secret: string = process.env.RAZORPAY_WEBHOOK_SECRET || ''
): boolean {
    try {
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(webhookBody)
            .digest('hex');

        return expectedSignature === signature;
    } catch (error) {
        console.error('Signature verification error:', error);
        return false;
    }
}

/**
 * Verify payment signature after redirect
 */
export function verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string
): boolean {
    try {
        const secret = process.env.RAZORPAY_KEY_SECRET || '';
        const generatedSignature = crypto
            .createHmac('sha256', secret)
            .update(`${orderId}|${paymentId}`)
            .digest('hex');

        return generatedSignature === signature;
    } catch (error) {
        console.error('Payment signature verification error:', error);
        return false;
    }
}

/**
 * Fetch payment details from Razorpay
 */
export async function fetchPaymentDetails(paymentId: string): Promise<any> {
    try {
        const razorpay = getRazorpayInstance();
        const payment = await razorpay.payments.fetch(paymentId);
        return payment;
    } catch (error) {
        console.error('Error fetching payment details:', error);
        return null;
    }
}

/**
 * Refund rejection (automatic response)
 */
export async function rejectRefundRequest(
    paymentId: string,
    reason: string = 'No refunds as per subscription policy'
): Promise<boolean> {
    try {
        // Note: Razorpay doesn't have a direct "reject refund" API
        // This is handled via customer support and policy enforcement
        // Log the rejection for admin review
        console.log('Refund rejection logged:', {
            paymentId,
            reason,
            timestamp: new Date().toISOString(),
        });

        return true;
    } catch (error) {
        console.error('Error rejecting refund:', error);
        return false;
    }
}

/**
 * Convert INR to paise (Razorpay uses paise)
 */
export function inrToPaise(inr: number): number {
    return Math.round(inr * 100);
}

/**
 * Convert paise to INR
 */
export function paiseToInr(paise: number): number {
    return paise / 100;
}

/**
 * Format currency for display
 */
export function formatCurrency(paise: number): string {
    const inr = paiseToInr(paise);
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(inr);
}
