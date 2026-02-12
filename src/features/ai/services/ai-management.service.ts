import { createClient } from '@/lib/supabase/server';

/**
 * AI Management Service
 * Handles rate limiting, quota checks, and usage logging
 */

export interface AIAvailability {
    available: boolean;
    reason?: string;
}

export interface TokenCheck {
    allowed: boolean;
    reason?: string;
    tokensUsed: number;
    tokensRemaining: number;
}

export interface UserTokenStats {
    tokensUsedToday: number;
    tokensRemainingToday: number;
    dailyLimit: number;
    requestsToday: number;
    estimatedCostToday: number;
}

/**
 * Check if AI features are available (system flags + peak hours)
 */
export async function checkAIAvailability(): Promise<AIAvailability> {
    const supabase = createClient();

    const { data, error } = await supabase
        .rpc('is_ai_available');

    if (error || !data) {
        return {
            available: false,
            reason: 'AI services temporarily unavailable',
        };
    }

    if (!data) {
        // Check if it's peak hours
        const now = new Date();
        const istHour = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getHours();

        if (istHour >= 10 && istHour < 18) {
            return {
                available: false,
                reason: 'AI disabled during peak hours (10 AM - 6 PM IST)',
            };
        }

        return {
            available: false,
            reason: 'AI features are currently disabled',
        };
    }

    return { available: true };
}

/**
 * Check user's daily token limit
 */
export async function checkUserTokenLimit(
    userId: string,
    estimatedTokens: number
): Promise<TokenCheck> {
    const supabase = createClient();

    const { data, error } = await supabase
        .rpc('check_user_token_limit', {
            p_user_id: userId,
            p_estimated_tokens: estimatedTokens,
        });

    if (error || !data || data.length === 0) {
        return {
            allowed: false,
            reason: 'Unable to check token limit',
            tokensUsed: 0,
            tokensRemaining: 0,
        };
    }

    const result = data[0];

    return {
        allowed: result.allowed,
        reason: result.reason,
        tokensUsed: result.tokens_used,
        tokensRemaining: result.tokens_remaining,
    };
}

/**
 * Check global daily token limit
 */
export async function checkGlobalTokenLimit(estimatedTokens: number): Promise<{
    allowed: boolean;
    reason?: string;
}> {
    const supabase = createClient();

    const { data, error } = await supabase
        .rpc('check_global_token_limit', {
            p_estimated_tokens: estimatedTokens,
        });

    if (error || !data || data.length === 0) {
        return {
            allowed: false,
            reason: 'Unable to check global limit',
        };
    }

    const result = data[0];

    return {
        allowed: result.allowed,
        reason: result.reason,
    };
}

/**
 * Check rate limit (requests per minute)
 */
export async function checkRateLimit(
    userId: string,
    maxPerMinute: number = 5
): Promise<boolean> {
    const supabase = createClient();

    const { data, error } = await supabase
        .rpc('check_rate_limit', {
            p_user_id: userId,
            p_max_per_minute: maxPerMinute,
        });

    if (error) {
        console.error('Rate limit check error:', error);
        return false; // Fail safe - deny request
    }

    return data === true;
}

/**
 * Increment rate limit counter
 */
export async function incrementRateLimit(userId: string): Promise<void> {
    const supabase = createClient();

    await supabase.rpc('increment_rate_limit', {
        p_user_id: userId,
    });
}

/**
 * Log AI usage to database
 */
export async function logAIUsage(
    userId: string,
    interactionType: 'doubt_solver' | 'performance_coach',
    inputTokens: number,
    outputTokens: number
): Promise<void> {
    const supabase = createClient();

    await supabase.rpc('log_ai_usage', {
        p_user_id: userId,
        p_interaction_type: interactionType,
        p_input_tokens: inputTokens,
        p_output_tokens: outputTokens,
    });
}

/**
 * Record detailed AI interaction log
 */
export async function recordAIInteraction(params: {
    userId: string;
    interactionType: 'doubt_solver' | 'performance_coach';
    promptText: string;
    responseText: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    modelName?: string;
    responseTimeMs?: number;
    status: 'success' | 'failed' | 'rate_limited' | 'quota_exceeded';
    errorMessage?: string;
    userAgent?: string;
    ipAddress?: string;
}): Promise<void> {
    const supabase = createClient();

    await supabase.from('ai_interaction_logs').insert({
        user_id: params.userId,
        interaction_type: params.interactionType,
        prompt_text: params.promptText,
        response_text: params.responseText || '',
        input_tokens: params.inputTokens,
        output_tokens: params.outputTokens,
        total_tokens: params.totalTokens,
        model_name: params.modelName || 'gemini-1.5-flash',
        response_time_ms: params.responseTimeMs,
        status: params.status,
        error_message: params.errorMessage,
        user_agent: params.userAgent,
        ip_address: params.ipAddress,
    });
}

/**
 * Get user's token usage statistics
 */
export async function getUserTokenStats(userId: string): Promise<UserTokenStats | null> {
    const supabase = createClient();

    const { data, error } = await supabase
        .rpc('get_user_token_stats', {
            p_user_id: userId,
        });

    if (error || !data || data.length === 0) {
        return null;
    }

    const stats = data[0];

    return {
        tokensUsedToday: stats.tokens_used_today,
        tokensRemainingToday: stats.tokens_remaining_today,
        dailyLimit: stats.daily_limit,
        requestsToday: stats.requests_today,
        estimatedCostToday: parseFloat(stats.estimated_cost_today),
    };
}

/**
 * Comprehensive pre-request check
 * Returns true if request should proceed
 */
export async function performAIPreChecks(
    userId: string,
    estimatedTokens: number
): Promise<{
    allowed: boolean;
    reason?: string;
    tokensRemaining?: number;
}> {
    // 1. Check if AI is available (system flags + peak hours)
    const availability = await checkAIAvailability();
    if (!availability.available) {
        return {
            allowed: false,
            reason: availability.reason,
        };
    }

    // 2. Check rate limit (5 requests per minute)
    const rateLimitOk = await checkRateLimit(userId, 5);
    if (!rateLimitOk) {
        return {
            allowed: false,
            reason: 'Rate limit exceeded. Please wait a moment before trying again.',
        };
    }

    // 3. Check user's daily token limit
    const userLimit = await checkUserTokenLimit(userId, estimatedTokens);
    if (!userLimit.allowed) {
        return {
            allowed: false,
            reason: `Daily token limit reached. You've used ${userLimit.tokensUsed} tokens today.`,
            tokensRemaining: userLimit.tokensRemaining,
        };
    }

    // 4. Check global daily token limit
    const globalLimit = await checkGlobalTokenLimit(estimatedTokens);
    if (!globalLimit.allowed) {
        return {
            allowed: false,
            reason: 'Global AI usage limit reached. Please try again tomorrow.',
        };
    }

    // All checks passed
    return {
        allowed: true,
        tokensRemaining: userLimit.tokensRemaining,
    };
}
