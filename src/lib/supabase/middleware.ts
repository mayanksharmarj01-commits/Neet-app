import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '../env';

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    // 1. Check if user is logged in
    if (
        !user &&
        !request.nextUrl.pathname.startsWith('/auth') &&
        !request.nextUrl.pathname.startsWith('/login') &&
        request.nextUrl.pathname !== '/'
    ) {
        const url = request.nextUrl.clone();
        url.pathname = '/auth/login';
        return NextResponse.redirect(url);
    }

    // 2. Strict Single Session Enforcement
    if (user && !request.nextUrl.pathname.startsWith('/auth')) {
        const activeSessionId = user.user_metadata?.active_session_id;
        const localSessionId = request.cookies.get('local_session_id')?.value;

        // If metadata has a session ID, but local cookie doesn't match it
        // It means another device logged in and updated the metadata.
        if (activeSessionId && localSessionId !== activeSessionId) {
            console.log("Session mismatch! Enforcing single session.");

            // Sign out
            await supabase.auth.signOut();

            const url = request.nextUrl.clone();
            url.pathname = '/auth/login';
            url.searchParams.set('error', 'session_expired'); // Optional: show message
            return NextResponse.redirect(url);
        }

        // Edge case: If user has local cookie but no metadata (e.g. fresh install or manual clear),
        // we might want to update metadata or just let it slide until next login.
        // For strict enforcement, we assume login sets it.
    }

    return supabaseResponse;
}
