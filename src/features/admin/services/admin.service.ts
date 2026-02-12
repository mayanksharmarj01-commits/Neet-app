import { createClient } from '@/lib/supabase/server';

/**
 * Admin Service
 * Handles all admin panel operations with RBAC checks
 */

export interface RevenueMetrics {
    totalRevenue: number;
    subscriptionRevenue: number;
    newSubscriptions: number;
    renewedSubscriptions: number;
    averageDealSize: number;
}

export interface DashboardStats {
    dau: number;
    mau: number;
    churnRate: number;
    revenue: RevenueMetrics;
    activeSubscribers: number;
    totalUsers: number;
}

/**
 * Check if user has admin role
 */
export async function isAdmin(userId: string): Promise<boolean> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('user_roles')
        .select('role_id, admin_roles(role_name)')
        .eq('user_id', userId)
        .limit(1);

    if (error || !data || data.length === 0) {
        return false;
    }

    return true;
}

/**
 * Check if user has specific permission
 */
export async function hasPermission(userId: string, permission: string): Promise<boolean> {
    const supabase = createClient();

    const { data, error } = await supabase.rpc('has_admin_permission', {
        p_user_id: userId,
        p_permission: permission,
    });

    if (error) {
        console.error('Permission check error:', error);
        return false;
    }

    return data === true;
}

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(
    startDate: string,
    endDate: string
): Promise<DashboardStats | null> {
    const supabase = createClient();

    try {
        // Get DAU
        const { data: dauData } = await supabase.rpc('get_dau', {
            p_date: endDate,
        });

        // Get MAU
        const { data: mauData } = await supabase.rpc('get_mau', {
            p_date: endDate,
        });

        // Get churn rate
        const { data: churnData } = await supabase.rpc('get_churn_rate', {
            p_start_date: startDate,
            p_end_date: endDate,
        });

        // Get revenue metrics
        const { data: revenueData } = await supabase.rpc('get_revenue_metrics', {
            p_start_date: startDate,
            p_end_date: endDate,
        });

        // Get active subscribers
        const { count: activeSubscribers } = await supabase
            .from('user_subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active')
            .gt('expires_at', new Date().toISOString());

        // Get total users
        const { count: totalUsers } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });

        const revenue = revenueData?.[0] || {
            total_revenue: 0,
            subscription_revenue: 0,
            new_subscriptions: 0,
            renewed_subscriptions: 0,
            average_deal_size: 0,
        };

        return {
            dau: dauData || 0,
            mau: mauData || 0,
            churnRate: parseFloat(churnData || '0'),
            revenue: {
                totalRevenue: parseFloat(revenue.total_revenue),
                subscriptionRevenue: parseFloat(revenue.subscription_revenue),
                newSubscriptions: revenue.new_subscriptions,
                renewedSubscriptions: revenue.renewed_subscriptions,
                averageDealSize: parseFloat(revenue.average_deal_size),
            },
            activeSubscribers: activeSubscribers || 0,
            totalUsers: totalUsers || 0,
        };
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        return null;
    }
}

/**
 * Get all users with pagination
 */
export async function getUsers(params: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
}) {
    const supabase = createClient();
    const offset = (params.page - 1) * params.limit;

    let query = supabase
        .from('users')
        .select('*, user_subscriptions(status, expires_at)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + params.limit - 1);

    if (params.search) {
        query = query.or(`email.ilike.%${params.search}%,full_name.ilike.%${params.search}%`);
    }

    if (params.status === 'active') {
        query = query.eq('subscription_status', 'active');
    } else if (params.status === 'inactive') {
        query = query.eq('subscription_status', 'inactive');
    } else if (params.status === 'banned') {
        query = query.eq('is_active', false);
    }

    const { data, error, count } = await query;

    if (error) {
        console.error('Error fetching users:', error);
        return { users: [], total: 0 };
    }

    return {
        users: data || [],
        total: count || 0,
    };
}

/**
 * Ban user
 */
export async function banUser(params: {
    userId: string;
    bannedBy: string;
    reason: string;
    isPermanent?: boolean;
    unbanAt?: string;
}) {
    const supabase = createClient();

    const { data, error } = await supabase.rpc('ban_user', {
        p_user_id: params.userId,
        p_banned_by: params.bannedBy,
        p_reason: params.reason,
        p_is_permanent: params.isPermanent || false,
        p_unban_at: params.unbanAt || null,
    });

    if (error) {
        console.error('Error banning user:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Unban user
 */
export async function unbanUser(userId: string) {
    const supabase = createClient();

    // Remove ban record
    const { error: banError } = await supabase
        .from('banned_users')
        .delete()
        .eq('user_id', userId);

    if (banError) {
        return { success: false, error: banError.message };
    }

    // Reactivate user
    const { error: userError } = await supabase
        .from('users')
        .update({ is_active: true })
        .eq('id', userId);

    if (userError) {
        return { success: false, error: userError.message };
    }

    return { success: true };
}

/**
 * Suspend subscription
 */
export async function suspendSubscription(subscriptionId: string, reason: string) {
    const supabase = createClient();

    const { error } = await supabase
        .from('user_subscriptions')
        .update({
            status: 'cancelled',
            metadata: { suspension_reason: reason, suspended_at: new Date().toISOString() },
        })
        .eq('id', subscriptionId);

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Update question marks
 */
export async function updateQuestionMarks(params: {
    questionId: string;
    newMarks: number;
    editedBy: string;
}) {
    const supabase = createClient();

    // Get old value for history
    const { data: oldQuestion } = await supabase
        .from('questions')
        .select('marks')
        .eq('id', params.questionId)
        .single();

    if (!oldQuestion) {
        return { success: false, error: 'Question not found' };
    }

    // Update question
    const { error: updateError } = await supabase
        .from('questions')
        .update({ marks: params.newMarks })
        .eq('id', params.questionId);

    if (updateError) {
        return { success: false, error: updateError.message };
    }

    // Log edit history
    await supabase.from('question_edit_history').insert({
        question_id: params.questionId,
        edited_by: params.editedBy,
        field_changed: 'marks',
        old_value: { marks: oldQuestion.marks },
        new_value: { marks: params.newMarks },
    });

    return { success: true };
}

/**
 * Override leaderboard
 */
export async function overrideLeaderboard(params: {
    userId: string;
    overrideType: 'rank' | 'score' | 'hide';
    overrideValue: any;
    reason: string;
    appliedBy: string;
    expiresAt?: string;
}) {
    const supabase = createClient();

    const { error } = await supabase.from('leaderboard_overrides').insert({
        user_id: params.userId,
        override_type: params.overrideType,
        override_value: params.overrideValue,
        reason: params.reason,
        applied_by: params.appliedBy,
        expires_at: params.expiresAt,
        is_active: true,
    });

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Get system flags
 */
export async function getSystemFlags() {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('system_flags')
        .select('*')
        .order('flag_name');

    if (error) {
        return { success: false, error: error.message, flags: [] };
    }

    return { success: true, flags: data || [] };
}

/**
 * Update system flag
 */
export async function updateSystemFlag(params: {
    flagName: string;
    flagValue: boolean;
    updatedBy: string;
}) {
    const supabase = createClient();

    const { error } = await supabase
        .from('system_flags')
        .update({
            flag_value: params.flagValue,
            updated_by: params.updatedBy,
            updated_at: new Date().toISOString(),
        })
        .eq('flag_name', params.flagName);

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Get bulk upload history
 */
export async function getBulkUploadHistory(limit: number = 20) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('bulk_upload_history')
        .select('*, users(email)')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        return { success: false, error: error.message, history: [] };
    }

    return { success: true, history: data || [] };
}

/**
 * Create backup
 */
export async function initiateBackup(params: {
    backupType: 'full' | 'incremental' | 'manual';
    initiatedBy: string;
    tablesIncluded?: string[];
}) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('backup_history')
        .insert({
            backup_type: params.backupType,
            initiated_by: params.initiatedBy,
            tables_included: params.tablesIncluded || [],
            status: 'in_progress',
        })
        .select()
        .single();

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true, backupId: data.id };
}
