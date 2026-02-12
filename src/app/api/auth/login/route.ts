import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
    getDeviceInfo,
    checkIpBlock,
    trackFailedLogin,
    checkDeviceChangeLimit,
    logDeviceChange,
    trackDevice,
    createUserSession,
    logIpActivity,
} from '@/features/auth/services/auth.service';

export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password are required' },
                { status: 400 }
            );
        }

        const deviceInfo = await getDeviceInfo();

        // Check if IP is blocked
        const isBlocked = await checkIpBlock(deviceInfo.ipAddress);
        if (isBlocked) {
            return NextResponse.json(
                { error: 'Your IP address has been temporarily blocked due to suspicious activity' },
                { status: 403 }
            );
        }

        const supabase = createClient();

        // Attempt to sign in
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            // Track failed login
            await trackFailedLogin(deviceInfo.ipAddress, email);

            return NextResponse.json(
                { error: error.message },
                { status: 401 }
            );
        }

        if (!data.user || !data.session) {
            return NextResponse.json(
                { error: 'Login failed' },
                { status: 401 }
            );
        }

        // Check if user is banned
        const { data: userData } = await supabase
            .from('users')
            .select('is_banned, banned_until, ban_reason')
            .eq('id', data.user.id)
            .single();

        if (userData?.is_banned) {
            const bannedUntil = userData.banned_until ? new Date(userData.banned_until) : null;
            if (!bannedUntil || bannedUntil > new Date()) {
                await supabase.auth.signOut();
                return NextResponse.json(
                    {
                        error: `Your account has been banned${userData.ban_reason ? `: ${userData.ban_reason}` : ''}`
                    },
                    { status: 403 }
                );
            }
        }

        // Check device change limits
        const deviceCheck = await checkDeviceChangeLimit(data.user.id, deviceInfo.deviceId);
        if (!deviceCheck.success) {
            await supabase.auth.signOut();
            return NextResponse.json(
                { error: deviceCheck.error },
                { status: 403 }
            );
        }

        // Get previous device
        const { data: previousDevice } = await supabase
            .from('device_tracking')
            .select('device_id')
            .eq('user_id', data.user.id)
            .eq('is_active', true)
            .order('last_seen_at', { ascending: false })
            .limit(1)
            .single();

        // Log device change if different device
        if (previousDevice && previousDevice.device_id !== deviceInfo.deviceId) {
            await logDeviceChange(
                data.user.id,
                previousDevice.device_id,
                deviceInfo.deviceId,
                deviceInfo.ipAddress,
                deviceInfo.userAgent
            );
        }

        // Track device
        await trackDevice(data.user.id, deviceInfo);

        // Create session record
        await createUserSession(data.user.id, data.session.access_token, deviceInfo);

        // Log successful login
        await logIpActivity(
            deviceInfo.ipAddress,
            'login',
            data.user.id,
            '/api/auth/login',
            200
        );

        return NextResponse.json({
            success: true,
            user: data.user,
            session: data.session,
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
