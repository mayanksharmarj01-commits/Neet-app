import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const supabase = createClient();

        const searchParams = request.nextUrl.searchParams;
        const status = searchParams.get('status') || 'scheduled,live';
        const isPublic = searchParams.get('isPublic');

        let query = supabase
            .from('arenas')
            .select(`
                *,
                users!arenas_created_by_fkey (
                    full_name,
                    email
                )
            `)
            .in('status', status.split(','))
            .order('scheduled_start_time', { ascending: true });

        if (isPublic !== null) {
            query = query.eq('is_public', isPublic === 'true');
        }

        const { data: arenas, error } = await query.limit(50);

        if (error) {
            return NextResponse.json(
                { error: 'Failed to fetch arenas' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            arenas: arenas || [],
        });
    } catch (error) {
        console.error('Error listing arenas:', error);
        return NextResponse.json(
            { error: 'Failed to list arenas' },
            { status: 500 }
        );
    }
}
