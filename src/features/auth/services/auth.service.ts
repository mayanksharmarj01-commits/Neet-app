import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

const MAX_DEVICE_CHANGES_PER_MONTH = 3;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const IP_BLOCK_DURATION_MINUTES = 30;
const SESSION_INACTIVITY_TIMEOUT_MINUTES = 30;

export interface AuthResult {
    success: boolean;
    error?: string;
    data?: any;
}

export interface DeviceInfo {
    deviceId: string;
    userAgent: string;
    ipAddress: string;
}

/**
 * Get device info from request headers
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
    const headersList = await headers();
    const userAgent = headersList.get('user-agent') || 'unknown';
    const forwardedFor = headersList.get('x-forwarded-for');
    const ipAddress = forwardedFor?.split(',')[0] || headersList.get('x-real-ip') || '0.0.0.0';

    // Create device fingerprint from user agent and other factors
    const deviceId = Buffer.from(`${userAgent}${ipAddress}`).toString('base64').substring(0, 32);

    return {
        deviceId,
        userAgent,
        ipAddress,
    };
}

/**
 * Check if IP is blocked
 */
export async function checkIpBlock(ipAddress: string): Promise<boolean> {
    const supabase = createClient();

    const { data, error } = await supabase
        .rpc('is_ip_blocked', { p_ip_address: ipAddress });

    if (error) {
        console.error('Error checking IP block:', error);
        return false;
    }

    return data || false;
}

/**
 * Block an IP address temporarily
 */
export async function blockIp(
    ipAddress: string,
    userId: string | null,
    reason: string,
    failedAttempts: number
): Promise<void> {
    const supabase = createClient();

    const blockedUntil = new Date();
    blockedUntil.setMinutes(blockedUntil.getMinutes() + IP_BLOCK_DURATION_MINUTES);

    await supabase.from('ip_blocks').insert({
        ip_address: ipAddress,
        user_id: userId,
        reason,
        failed_attempts: failedAttempts,
        blocked_until: blockedUntil.toISOString(),
        is_active: true,
    });
}

/**
 * Track failed login attempt
 */
export async function trackFailedLogin(
    ipAddress: string,
    email?: string
): Promise<void> {
    const supabase = createClient();

    // Count recent failed attempts from this IP
    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

    const { count } = await supabase
        .from('ip_logs')
        .select('*', { count: 'exact', head: true })
        .eq('ip_address', ipAddress)
        .eq('action', 'failed_login')
        .gte('created_at', thirtyMinutesAgo.toISOString());

    const failedAttempts = (count || 0) + 1;

    // Log this failed attempt
    await supabase.from('ip_logs').insert({
        ip_address: ipAddress,
        action: 'failed_login',
        endpoint: '/api/auth/login',
        method: 'POST',
        status_code: 401,
        is_suspicious: failedAttempts >= 3,
        risk_score: Math.min(failedAttempts * 20, 100),
        metadata: { email, attempt: failedAttempts },
    });

    // Block IP if too many failed attempts
    if (failedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
        await blockIp(ipAddress, null, 'Too many failed login attempts', failedAttempts);
    }
}

/**
 * Check device change limits
 */
export async function checkDeviceChangeLimit(
    userId: string,
    currentDeviceId: string
): Promise<AuthResult> {
    const supabase = createClient();

    // Get user's most recent active device
    const { data: deviceData } = await supabase
        .from('device_tracking')
        .select('device_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_seen_at', { ascending: false })
        .limit(1)
        .single();

    // If this is the same device, allow it
    if (deviceData && deviceData.device_id === currentDeviceId) {
        return { success: true };
    }

    // Check device changes this month
    const { data: changeCount } = await supabase
        .rpc('count_device_changes_current_month', { p_user_id: userId });

    if ((changeCount || 0) >= MAX_DEVICE_CHANGES_PER_MONTH) {
        return {
            success: false,
            error: `Device change limit reached. You can only change devices ${MAX_DEVICE_CHANGES_PER_MONTH} times per month.`,
        };
    }

    return { success: true };
}

/**
 * Log device change
 */
export async function logDeviceChange(
    userId: string,
    oldDeviceId: string | null,
    newDeviceId: string,
    ipAddress: string,
    userAgent: string
): Promise<void> {
    const supabase = createClient();
    const now = new Date();

    await supabase.from('device_changes_log').insert({
        user_id: userId,
        old_device_id: oldDeviceId,
        new_device_id: newDeviceId,
        ip_address: ipAddress,
        user_agent: userAgent,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
    });
}

/**
 * Create or update device tracking
 */
export async function trackDevice(
    userId: string,
    deviceInfo: DeviceInfo
): Promise<void> {
    const supabase = createClient();

    // Check if device exists
    const { data: existing } = await supabase
        .from('device_tracking')
        .select('*')
        .eq('user_id', userId)
        .eq('device_id', deviceInfo.deviceId)
        .single();

    if (existing) {
        // Update existing device
        await supabase
            .from('device_tracking')
            .update({
                is_active: true,
                last_seen_at: new Date().toISOString(),
                ip_address: deviceInfo.ipAddress,
            })
            .eq('id', existing.id);
    } else {
        // Create new device entry
        await supabase.from('device_tracking').insert({
            user_id: userId,
            device_id: deviceInfo.deviceId,
            device_name: `Device ${deviceInfo.deviceId.substring(0, 8)}`,
            ip_address: deviceInfo.ipAddress,
            user_agent: deviceInfo.userAgent,
            is_active: true,
        });
    }

    // Deactivate all other devices
    await supabase
        .from('device_tracking')
        .update({ is_active: false })
        .eq('user_id', userId)
        .neq('device_id', deviceInfo.deviceId);
}

/**
 * Create user session
 */
export async function createUserSession(
    userId: string,
    sessionToken: string,
    deviceInfo: DeviceInfo
): Promise<void> {
    const supabase = createClient();

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24-hour session

    await supabase.from('user_sessions').insert({
        user_id: userId,
        session_token: sessionToken,
        device_id: deviceInfo.deviceId,
        ip_address: deviceInfo.ipAddress,
        user_agent: deviceInfo.userAgent,
        is_active: true,
        expires_at: expiresAt.toISOString(),
    });
}

/**
 * Check if session is active and not expired
 */
export async function validateSession(sessionToken: string): Promise<AuthResult> {
    const supabase = createClient();

    const { data: session, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('session_token', sessionToken)
        .eq('is_active', true)
        .single();

    if (error || !session) {
        return { success: false, error: 'Invalid session' };
    }

    // Check if expired
    if (new Date(session.expires_at) < new Date()) {
        await supabase
            .from('user_sessions')
            .update({ is_active: false })
            .eq('id', session.id);

        return { success: false, error: 'Session expired' };
    }

    // Check inactivity timeout
    const lastActivity = new Date(session.last_activity_at);
    const inactivityMinutes = (Date.now() - lastActivity.getTime()) / (1000 * 60);

    if (inactivityMinutes > SESSION_INACTIVITY_TIMEOUT_MINUTES) {
        await supabase
            .from('user_sessions')
            .update({ is_active: false })
            .eq('id', session.id);

        return { success: false, error: 'Session timed out due to inactivity' };
    }

    // Update last activity
    await supabase.rpc('update_session_activity', { p_session_token: sessionToken });

    return { success: true, data: session };
}

/**
 * Deactivate user session
 */
export async function deactivateSession(sessionToken: string): Promise<void> {
    const supabase = createClient();

    await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('session_token', sessionToken);
}

/**
 * Check if user has required consents
 */
export async function checkUserConsents(userId: string): Promise<{
    hasTermsConsent: boolean;
    hasAgeConsent: boolean;
}> {
    const supabase = createClient();

    const { data: termsConsent } = await supabase
        .rpc('has_user_consent', {
            p_user_id: userId,
            p_consent_type: 'terms_and_conditions',
        });

    const { data: ageConsent } = await supabase
        .rpc('has_user_consent', {
            p_user_id: userId,
            p_consent_type: 'age_declaration',
        });

    return {
        hasTermsConsent: termsConsent || false,
        hasAgeConsent: ageConsent || false,
    };
}

/**
 * Record user consent
 */
export async function recordConsent(
    userId: string,
    consentType: 'terms_and_conditions' | 'privacy_policy' | 'age_declaration',
    version: string,
    ipAddress: string,
    userAgent: string,
    metadata?: Record<string, any>
): Promise<void> {
    const supabase = createClient();

    await supabase.from('user_consents').insert({
        user_id: userId,
        consent_type: consentType,
        consent_version: version,
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: metadata || {},
    });
}

/**
 * Log IP activity
 */
export async function logIpActivity(
    ipAddress: string,
    action: string,
    userId?: string,
    endpoint?: string,
    statusCode?: number
): Promise<void> {
    const supabase = createClient();
    const headersList = await headers();
    const userAgent = headersList.get('user-agent') || 'unknown';

    await supabase.from('ip_logs').insert({
        ip_address: ipAddress,
        user_id: userId || null,
        action,
        endpoint: endpoint || null,
        method: 'POST',
        status_code: statusCode || 200,
        user_agent: userAgent,
    });
}
