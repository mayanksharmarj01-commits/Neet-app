import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { analyzePerformance, estimateTokens } from '@/lib/gemini/gemini.service';
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

        const { performanceData } = await request.json();

        if (!performanceData) {
            return NextResponse.json(
                { error: 'Performance data is required' },
                { status: 400 }
            );
        }

        // Estimate tokens (performance data is small, response is moderate)
        const estimatedTokens = 200 + 600; // ~200 input + 600 output

        // Perform all pre-checks
        const preCheck = await performAIPreChecks(user.id, estimatedTokens);

        if (!preCheck.allowed) {
            await recordAIInteraction({
                userId: user.id,
                interactionType: 'performance_coach',
                promptText: JSON.stringify(performanceData),
                responseText: '',
                inputTokens: 200,
                outputTokens: 0,
                totalTokens: 200,
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

        // Increment rate limit
        await incrementRateLimit(user.id);

        // Generate coaching analysis
        const result = await analyzePerformance(performanceData);

        const responseTime = Date.now() - startTime;

        if (!result.success) {
            await recordAIInteraction({
                userId: user.id,
                interactionType: 'performance_coach',
                promptText: JSON.stringify(performanceData),
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
                { error: result.error || 'Failed to generate analysis' },
                { status: 500 }
            );
        }

        // Log successful usage
        await logAIUsage(
            user.id,
            'performance_coach',
            result.inputTokens,
            result.outputTokens
        );

        // Record detailed interaction
        await recordAIInteraction({
            userId: user.id,
            interactionType: 'performance_coach',
            promptText: JSON.stringify(performanceData),
            responseText: result.analysis || '',
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            totalTokens: result.totalTokens,
            responseTimeMs: responseTime,
            status: 'success',
            userAgent: request.headers.get('user-agent') || undefined,
        });

        return NextResponse.json({
            success: true,
            analysis: result.analysis,
            tokensUsed: result.totalTokens,
            tokensRemaining: (preCheck.tokensRemaining || 0) - result.totalTokens,
            cost: result.cost,
        });
    } catch (error: any) {
        console.error('Performance coach error:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
