import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
    getDeviceInfo,
    checkIpBlock,
    trackDevice,
    createUserSession,
    recordConsent,
    logIpActivity,
} from '@/features/auth/services/auth.service';

export async function POST(request: NextRequest) {
    try {
        const {
            email,
            password,
            fullName,
            acceptTerms,
            ageConfirmation, // User confirms they are 18+
        } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password are required' },
                { status: 400 }
            );
        }

        if (!acceptTerms) {
            return NextResponse.json(
                { error: 'You must accept the terms and conditions' },
                { status: 400 }
            );
        }

        if (!ageConfirmation) {
            return NextResponse.json(
                { error: 'You must confirm you are 18 years or older' },
                { status: 400 }
            );
        }

        const deviceInfo = await getDeviceInfo();

        // Check if IP is blocked
        const isBlocked = await checkIpBlock(deviceInfo.ipAddress);
        if (isBlocked) {
            return NextResponse.json(
                { error: 'Your IP address has been temporarily blocked' },
                { status: 403 }
            );
        }

        const supabase = createClient();

        // Create auth user
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                },
            },
        });

        if (error) {
            return NextResponse.json(
                { error: error.message },
                { status: 400 }
            );
        }

        if (!data.user) {
            return NextResponse.json(
                { error: 'Signup failed' },
                { status: 400 }
            );
        }

        // Create user profile in users table
        const { error: profileError } = await supabase
            .from('users')
            .insert({
                id: data.user.id,
                email: data.user.email!,
                full_name: fullName,
            });

        if (profileError) {
            console.error('Error creating user profile:', profileError);
            // Continue anyway - RLS might prevent this, but auth user is created
        }

        // Record consents
        await recordConsent(
            data.user.id,
            'terms_and_conditions',
            '1.0',
            deviceInfo.ipAddress,
            deviceInfo.userAgent
        );

        await recordConsent(
            data.user.id,
            'age_declaration',
            '1.0',
            deviceInfo.ipAddress,
            deviceInfo.userAgent,
            { age_confirmed: true, minimum_age: 18 }
        );

        // If session exists (auto-login after signup)
        if (data.session) {
            // Track device
            await trackDevice(data.user.id, deviceInfo);

            // Create session record
            await createUserSession(data.user.id, data.session.access_token, deviceInfo);

            // Log signup
            await logIpActivity(
                deviceInfo.ipAddress,
                'signup',
                data.user.id,
                '/api/auth/signup',
                201
            );

            return NextResponse.json({
                success: true,
                user: data.user,
                session: data.session,
                message: 'Account created successfully',
            });
        }

        return NextResponse.json({
            success: true,
            user: data.user,
            message: 'Account created successfully. Please check your email to verify your account.',
        });
    } catch (error) {
        console.error('Signup error:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
