import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdmin, hasPermission } from '@/features/admin/services/admin.service';
import { parseCSV, bulkInsertQuestions, generateCSVTemplate } from '@/features/admin/services/csv-upload.service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check content permission
        const canManageContent = await hasPermission(user.id, 'content');
        if (!canManageContent) {
            return NextResponse.json(
                { error: 'Forbidden - Content management permission required' },
                { status: 403 }
            );
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json(
                { error: 'No file uploaded' },
                { status: 400 }
            );
        }

        // Read file content
        const fileContent = await file.text();

        // Parse and validate CSV
        const parseResult = await parseCSV(fileContent);

        if (!parseResult.success) {
            return NextResponse.json(
                {
                    success: false,
                    errors: parseResult.errors,
                    totalRows: parseResult.totalRows,
                },
                { status: 400 }
            );
        }

        // Bulk insert questions
        const insertResult = await bulkInsertQuestions(
            parseResult.data!,
            user.id,
            file.name
        );

        if (!insertResult.success) {
            return NextResponse.json(
                {
                    success: false,
                    errors: insertResult.errors,
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            uploadId: insertResult.uploadId,
            successCount: insertResult.successCount,
            failedCount: insertResult.failedCount,
            errors: insertResult.errors,
        });
    } catch (error: any) {
        console.error('CSV upload error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user || !(await hasPermission(user.id, 'content'))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const searchParams = request.nextUrl.searchParams;
        const action = searchParams.get('action');

        if (action === 'template') {
            // Generate CSV template
            const template = generateCSVTemplate();

            return new NextResponse(template, {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': 'attachment; filename="questions_template.csv"',
                },
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
