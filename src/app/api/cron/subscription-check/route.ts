import { NextRequest, NextResponse } from 'next/server';
import { processExpiredSubscriptions, getSubscriptionsNeedingReminders, recordReminderSent } from '@/features/subscription/services/subscription.service';

export const runtime = 'edge';

/**
 * Cron job to:
 * 1. Process expired subscriptions
 * 2. Send expiry reminders (7d, 3d, 1d)
 * 
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/subscription-check",
 *     "schedule": "0 * * * *"  // Every hour
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
    try {
        // Verify cron secret
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // 1. Process expired subscriptions
        const expiredCount = await processExpiredSubscriptions();
        console.log(`Processed ${expiredCount} expired subscriptions`);

        // 2. Get subscriptions needing reminders
        const reminders = await getSubscriptionsNeedingReminders();
        console.log(`Found ${reminders.length} subscriptions needing reminders`);

        // 3. Send reminders
        for (const reminder of reminders) {
            // Record reminder
            await recordReminderSent(
                reminder.subscription_id,
                reminder.user_id,
                reminder.reminder_type
            );

            // TODO: Send email notification
            console.log(`Reminder sent: ${reminder.reminder_type} to ${reminder.user_email}`);
        }

        return NextResponse.json({
            success: true,
            expiredCount,
            remindersSent: reminders.length,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Cron job error:', error);
        return NextResponse.json(
            { error: 'Cron job failed' },
            { status: 500 }
        );
    }
}
