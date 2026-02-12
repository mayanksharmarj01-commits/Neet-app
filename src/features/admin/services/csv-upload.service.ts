import { createClient } from '@/lib/supabase/server';
import Papa from 'papaparse';

/**
 * CSV Bulk Upload Service
 * Validates and inserts questions in bulk
 */

export interface CSVQuestion {
    subject: string;
    chapter?: string;
    difficulty: 'easy' | 'medium' | 'hard';
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_answer: 'A' | 'B' | 'C' | 'D';
    explanation?: string;
    marks: number;
    tags?: string; // Comma-separated
    topics?: string; // Comma-separated
}

export interface ValidationError {
    row: number;
    field: string;
    error: string;
    value?: any;
}

/**
 * Validate CSV row
 */
function validateQuestionRow(row: any, rowIndex: number): ValidationError[] {
    const errors: ValidationError[] = [];

    // Required fields
    const requiredFields = [
        'subject',
        'difficulty',
        'question_text',
        'option_a',
        'option_b',
        'option_c',
        'option_d',
        'correct_answer',
        'marks',
    ];

    for (const field of requiredFields) {
        if (!row[field] || row[field].toString().trim() === '') {
            errors.push({
                row: rowIndex,
                field,
                error: `${field} is required`,
            });
        }
    }

    // Validate difficulty
    if (row.difficulty && !['easy', 'medium', 'hard'].includes(row.difficulty.toLowerCase())) {
        errors.push({
            row: rowIndex,
            field: 'difficulty',
            error: 'Must be one of: easy, medium, hard',
            value: row.difficulty,
        });
    }

    // Validate correct_answer
    if (row.correct_answer && !['A', 'B', 'C', 'D'].includes(row.correct_answer.toUpperCase())) {
        errors.push({
            row: rowIndex,
            field: 'correct_answer',
            error: 'Must be one of: A, B, C, D',
            value: row.correct_answer,
        });
    }

    // Validate marks
    const marks = parseInt(row.marks);
    if (isNaN(marks) || marks < 1 || marks > 10) {
        errors.push({
            row: rowIndex,
            field: 'marks',
            error: 'Must be a number between 1 and 10',
            value: row.marks,
        });
    }

    // Validate question text length
    if (row.question_text && row.question_text.length > 5000) {
        errors.push({
            row: rowIndex,
            field: 'question_text',
            error: 'Maximum 5000 characters',
            value: row.question_text.length,
        });
    }

    // Validate options length
    const options = ['option_a', 'option_b', 'option_c', 'option_d'];
    for (const option of options) {
        if (row[option] && row[option].length > 1000) {
            errors.push({
                row: rowIndex,
                field: option,
                error: 'Maximum 1000 characters',
                value: row[option].length,
            });
        }
    }

    return errors;
}

/**
 * Parse and validate CSV file
 */
export async function parseCSV(fileContent: string): Promise<{
    success: boolean;
    data?: CSVQuestion[];
    errors?: ValidationError[];
    totalRows?: number;
}> {
    return new Promise((resolve) => {
        Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const data = results.data as CSVQuestion[];
                const allErrors: ValidationError[] = [];

                // Validate each row
                data.forEach((row, index) => {
                    const rowErrors = validateQuestionRow(row, index + 2); // +2 for header and 0-index
                    allErrors.push(...rowErrors);
                });

                if (allErrors.length > 0) {
                    resolve({
                        success: false,
                        errors: allErrors,
                        totalRows: data.length,
                    });
                } else {
                    resolve({
                        success: true,
                        data,
                        totalRows: data.length,
                    });
                }
            },
            error: (error: any) => {
                resolve({
                    success: false,
                    errors: [
                        {
                            row: 0,
                            field: 'file',
                            error: error.message || 'Unknown error',
                        },
                    ],
                });
            },
        });
    });
}

/**
 * Bulk insert questions
 */
export async function bulkInsertQuestions(
    questions: CSVQuestion[],
    uploadedBy: string,
    fileName: string
): Promise<{
    success: boolean;
    uploadId?: string;
    successCount?: number;
    failedCount?: number;
    errors?: any[];
}> {
    const supabase = createClient();

    try {
        // Create upload record
        const { data: uploadRecord, error: uploadError } = await supabase
            .from('bulk_upload_history')
            .insert({
                uploaded_by: uploadedBy,
                file_name: fileName,
                total_rows: questions.length,
                status: 'processing',
            })
            .select()
            .single();

        if (uploadError) {
            return {
                success: false,
                errors: [uploadError],
            };
        }

        const uploadId = uploadRecord.id;
        let successCount = 0;
        let failedCount = 0;
        const errors: any[] = [];

        // Get subject and chapter mappings
        const subjectMap = new Map<string, string>();
        const chapterMap = new Map<string, string>();

        const { data: subjects } = await supabase.from('subjects').select('id, name');
        subjects?.forEach((s) => {
            subjectMap.set(s.name.toLowerCase(), s.id);
        });

        const { data: chapters } = await supabase.from('chapters').select('id, name, subject_id');
        chapters?.forEach((c) => {
            chapterMap.set(`${c.subject_id}_${c.name.toLowerCase()}`, c.id);
        });

        // Insert questions in batches of 100
        const batchSize = 100;
        for (let i = 0; i < questions.length; i += batchSize) {
            const batch = questions.slice(i, i + batchSize);
            const questionsToInsert = [];

            for (const q of batch) {
                try {
                    const subjectId = subjectMap.get(q.subject.toLowerCase());
                    if (!subjectId) {
                        failedCount++;
                        errors.push({
                            row: i + batch.indexOf(q) + 2,
                            error: `Subject not found: ${q.subject}`,
                        });
                        continue;
                    }

                    let chapterId = null;
                    if (q.chapter) {
                        chapterId = chapterMap.get(`${subjectId}_${q.chapter.toLowerCase()}`);
                        if (!chapterId) {
                            // Create chapter if it doesn't exist
                            const { data: newChapter } = await supabase
                                .from('chapters')
                                .insert({
                                    subject_id: subjectId,
                                    name: q.chapter,
                                })
                                .select()
                                .single();

                            if (newChapter) {
                                chapterId = newChapter.id;
                                chapterMap.set(`${subjectId}_${q.chapter.toLowerCase()}`, chapterId);
                            }
                        }
                    }

                    const tags = q.tags ? q.tags.split(',').map((t) => t.trim()) : [];
                    const topics = q.topics ? q.topics.split(',').map((t) => t.trim()) : [];

                    questionsToInsert.push({
                        subject_id: subjectId,
                        chapter_id: chapterId,
                        difficulty: q.difficulty.toLowerCase(),
                        question_text: q.question_text.trim(),
                        options: {
                            A: q.option_a.trim(),
                            B: q.option_b.trim(),
                            C: q.option_c.trim(),
                            D: q.option_d.trim(),
                        },
                        correct_answer: q.correct_answer.toUpperCase(),
                        explanation: q.explanation?.trim() || null,
                        marks: parseInt(q.marks.toString()),
                        tags,
                        topics,
                        is_active: true,
                    });
                } catch (error: any) {
                    failedCount++;
                    errors.push({
                        row: i + batch.indexOf(q) + 2,
                        error: error.message,
                    });
                }
            }

            // Insert batch
            if (questionsToInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from('questions')
                    .insert(questionsToInsert);

                if (insertError) {
                    failedCount += questionsToInsert.length;
                    errors.push({
                        batch: i / batchSize + 1,
                        error: insertError.message,
                    });
                } else {
                    successCount += questionsToInsert.length;
                }
            }
        }

        // Update upload record
        await supabase
            .from('bulk_upload_history')
            .update({
                successful_rows: successCount,
                failed_rows: failedCount,
                validation_errors: errors,
                status: failedCount === 0 ? 'completed' : 'completed',
                completed_at: new Date().toISOString(),
            })
            .eq('id', uploadId);

        return {
            success: true,
            uploadId,
            successCount,
            failedCount,
            errors: failedCount > 0 ? errors : undefined,
        };
    } catch (error: any) {
        console.error('Bulk insert error:', error);
        return {
            success: false,
            errors: [{ error: error.message }],
        };
    }
}

/**
 * Generate CSV template
 */
export function generateCSVTemplate(): string {
    const headers = [
        'subject',
        'chapter',
        'difficulty',
        'question_text',
        'option_a',
        'option_b',
        'option_c',
        'option_d',
        'correct_answer',
        'explanation',
        'marks',
        'tags',
        'topics',
    ];

    const exampleRow = [
        'Physics',
        'Mechanics',
        'medium',
        'What is Newton\'s first law?',
        'An object at rest stays at rest',
        'F = ma',
        'Action and reaction are equal',
        'Every object attracts every other object',
        'A',
        'Newton\'s first law is also known as the law of inertia',
        '2',
        'newton, laws of motion',
        'mechanics, classical physics',
    ];

    return [headers.join(','), exampleRow.join(',')].join('\n');
}
