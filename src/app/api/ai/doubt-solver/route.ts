import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { solveDoubt, validatePrompt, estimateTokens } from '@/lib/gemini/gemini.service';
import {
    performAIPreChecks,
    incrementRateLimit,
    logAIUsage,
    recordAIInteraction,
} from '@/features/ai/services/ai-management.service';

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { question, context } = await request.json();

        if (!question) {
            return NextResponse.json(
                { error: 'Question is required' },
                { status: 400 }
            );
        }

        // Validate prompt
        const validation = validatePrompt(question);
        if (!validation.valid) {
            return NextResponse.json(
                { error: validation.reason },
                { status: 400 }
            );
        }

        // Estimate tokens
        const estimatedTokens = estimateTokens(question) + 800; // Estimate response tokens

        // Perform all pre-checks (availability, rate limit, quotas)
        const preCheck = await performAIPreChecks(user.id, estimatedTokens);

        if (!preCheck.allowed) {
            // Log failed attempt
            await recordAIInteraction({
                userId: user.id,
                interactionType: 'doubt_solver',
                promptText: question,
                responseText: '',
                inputTokens: estimateTokens(question),
                outputTokens: 0,
                totalTokens: estimateTokens(question),
                status: preCheck.reason?.includes('Rate limit') ? 'rate_limited' : 'quota_exceeded',
                errorMessage: preCheck.reason,
                userAgent: request.headers.get('user-agent') || undefined,
            });

            return NextResponse.json(
                {
                    error: preCheck.reason,
                    tokensRemaining: preCheck.tokensRemaining,
                },
                { status: 429 }
            );
        }

        // Increment rate limit counter
        await incrementRateLimit(user.id);

        // Generate AI response
        const result = await solveDoubt(question, context);

        const responseTime = Date.now() - startTime;

        if (!result.success) {
            // Log failed interaction
            await recordAIInteraction({
                userId: user.id,
                interactionType: 'doubt_solver',
                promptText: question,
                responseText: '',
                inputTokens: result.inputTokens,
                outputTokens: result.outputTokens,
                totalTokens: result.totalTokens,
                responseTimeMs: responseTime,
                status: 'failed',
                errorMessage: result.error,
                userAgent: request.headers.get('user-agent') || undefined,
            });

            return NextResponse.json(
                { error: result.error || 'Failed to generate response' },
                { status: 500 }
            );
        }

        // Log successful usage
        await logAIUsage(
            user.id,
            'doubt_solver',
            result.inputTokens,
            result.outputTokens
        );

        // Record detailed interaction
        await recordAIInteraction({
            userId: user.id,
            interactionType: 'doubt_solver',
            promptText: question,
            responseText: result.answer || '',
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            totalTokens: result.totalTokens,
            responseTimeMs: responseTime,
            status: 'success',
            userAgent: request.headers.get('user-agent') || undefined,
        });

        return NextResponse.json({
            success: true,
            answer: result.answer,
            tokensUsed: result.totalTokens,
            tokensRemaining: (preCheck.tokensRemaining || 0) - result.totalTokens,
            cost: result.cost,
        });
    } catch (error: any) {
        console.error('Doubt solver error:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
