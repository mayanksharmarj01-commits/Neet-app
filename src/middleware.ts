import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from './lib/env';

// Routes that don't require authentication
const publicRoutes = ['/auth/login', '/auth/signup', '/auth/forgot-password', '/'];

// Routes that require authentication
const protectedRoutes = ['/dashboard', '/mock', '/arena', '/leaderboard', '/messaging', '/admin', '/settings'];

// Routes that require consent check
const consentRequiredRoutes = ['/dashboard', '/mock', '/arena', '/leaderboard', '/messaging'];

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    });
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    });
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value: '',
                        ...options,
                    });
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    response.cookies.set({
                        name,
                        value: '',
                        ...options,
                    });
                },
            },
        }
    );

    const { data: { session }, error } = await supabase.auth.getSession();
    const pathname = request.nextUrl.pathname;

    // Check if route is protected
    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
    const isPublicRoute = publicRoutes.some(route => pathname === route);

    // Redirect to login if accessing protected route without session
    if (isProtectedRoute && (!session || error)) {
        const redirectUrl = new URL('/auth/login', request.url);
        redirectUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(redirectUrl);
    }

    // If user is authenticated
    if (session && session.user) {
        // Check if session is active in database
        const { data: dbSession } = await supabase
            .from('user_sessions')
            .select('*')
            .eq('session_token', session.access_token)
            .eq('is_active', true)
            .single();

        if (!dbSession) {
            // Session not found or inactive - force logout
            await supabase.auth.signOut();
            const redirectUrl = new URL('/auth/login', request.url);
            redirectUrl.searchParams.set('error', 'session_expired');
            return NextResponse.redirect(redirectUrl);
        }

        // Check session expiry
        if (new Date(dbSession.expires_at) < new Date()) {
            await supabase.auth.signOut();
            await supabase
                .from('user_sessions')
                .update({ is_active: false })
                .eq('id', dbSession.id);

            const redirectUrl = new URL('/auth/login', request.url);
            redirectUrl.searchParams.set('error', 'session_expired');
            return NextResponse.redirect(redirectUrl);
        }

        // Check inactivity timeout (30 minutes)
        const lastActivity = new Date(dbSession.last_activity_at);
        const inactivityMinutes = (Date.now() - lastActivity.getTime()) / (1000 * 60);

        if (inactivityMinutes > 30) {
            await supabase.auth.signOut();
            await supabase
                .from('user_sessions')
                .update({ is_active: false })
                .eq('id', dbSession.id);

            const redirectUrl = new URL('/auth/login', request.url);
            redirectUrl.searchParams.set('error', 'session_timeout');
            return NextResponse.redirect(redirectUrl);
        }

        // Check if user is banned
        const { data: userData } = await supabase
            .from('users')
            .select('is_banned, banned_until')
            .eq('id', session.user.id)
            .single();

        if (userData?.is_banned) {
            const bannedUntil = userData.banned_until ? new Date(userData.banned_until) : null;
            if (!bannedUntil || bannedUntil > new Date()) {
                await supabase.auth.signOut();
                const redirectUrl = new URL('/auth/login', request.url);
                redirectUrl.searchParams.set('error', 'account_banned');
                return NextResponse.redirect(redirectUrl);
            }
        }

        // Check consents for routes that require them
        if (consentRequiredRoutes.some(route => pathname.startsWith(route))) {
            const { data: termsConsent } = await supabase
                .from('user_consents')
                .select('id')
                .eq('user_id', session.user.id)
                .eq('consent_type', 'terms_and_conditions')
                .single();

            const { data: ageConsent } = await supabase
                .from('user_consents')
                .select('id')
                .eq('user_id', session.user.id)
                .eq('consent_type', 'age_declaration')
                .single();

            if (!termsConsent || !ageConsent) {
                const redirectUrl = new URL('/auth/consent-required', request.url);
                redirectUrl.searchParams.set('redirect', pathname);
                return NextResponse.redirect(redirectUrl);
            }
        }

        // Update last activity timestamp
        await supabase
            .from('user_sessions')
            .update({ last_activity_at: new Date().toISOString() })
            .eq('id', dbSession.id);

        // Redirect authenticated users away from auth pages
        if (pathname.startsWith('/auth/login') || pathname.startsWith('/auth/signup')) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
