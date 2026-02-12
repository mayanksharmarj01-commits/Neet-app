import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '../env';

export function createClient() {
    const cookieStore = cookies();

    return createServerClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                async get(name: string) {
                    const cookie = (await cookieStore).get(name)?.value;
                    return cookie;
                },
                async set(name: string, value: string, options: CookieOptions) {
                    try {
                        (await cookieStore).set({ name, value, ...options });
                    } catch (error) {
                        // Handle cookie setting errors (e.g., in Server Components)
                        console.error('Error setting cookie:', error);
                    }
                },
                async remove(name: string, options: CookieOptions) {
                    try {
                        (await cookieStore).set({ name, value: '', ...options });
                    } catch (error) {
                        console.error('Error removing cookie:', error);
                    }
                },
            },
        }
    );
}

export async function getUser() {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
        return null;
    }
    
    return user;
}

export async function getSession() {
    const supabase = createClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
        return null;
    }
    
    return session;
}
