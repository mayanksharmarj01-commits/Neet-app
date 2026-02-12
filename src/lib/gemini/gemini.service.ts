import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Gemini AI Service with token tracking and error handling
 */

// Initialize Gemini AI
const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured');
    }

    return new GoogleGenerativeAI(apiKey);
};

// Cost per 1M tokens (Gemini 1.5 Flash)
const COST_PER_MILLION_TOKENS = 0.075; // $0.075 per 1M tokens

/**
 * Count tokens in text (approximate)
 * Note: Use Gemini's countTokens API for accurate count
 */
export function estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
}

/**
 * Calculate cost for tokens
 */
export function calculateCost(tokens: number): number {
    return (tokens / 1_000_000) * COST_PER_MILLION_TOKENS;
}

/**
 * Generate AI response with token tracking
 */
export async function generateAIResponse(
    prompt: string,
    systemPrompt?: string,
    options: {
        temperature?: number;
        maxOutputTokens?: number;
        model?: string;
    } = {}
): Promise<{
    success: boolean;
    response?: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
    error?: string;
}> {
    try {
        const genAI = getGeminiClient();

        const modelName = options.model || 'gemini-1.5-flash';
        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                temperature: options.temperature || 0.7,
                maxOutputTokens: options.maxOutputTokens || 1024,
            },
        });

        // Combine system prompt and user prompt
        const fullPrompt = systemPrompt
            ? `${systemPrompt}\n\nUser Query: ${prompt}`
            : prompt;

        // Generate response
        const startTime = Date.now();
        const result = await model.generateContent(fullPrompt);
        const responseTime = Date.now() - startTime;

        const response = result.response.text();

        // Count tokens
        const inputTokens = estimateTokens(fullPrompt);
        const outputTokens = estimateTokens(response);
        const totalTokens = inputTokens + outputTokens;

        // Calculate cost
        const cost = calculateCost(totalTokens);

        return {
            success: true,
            response,
            inputTokens,
            outputTokens,
            totalTokens,
            cost,
        };
    } catch (error: any) {
        console.error('Gemini AI error:', error);

        // Estimate tokens even on error (for logging)
        const inputTokens = estimateTokens(prompt + (systemPrompt || ''));

        return {
            success: false,
            error: error.message || 'AI generation failed',
            inputTokens,
            outputTokens: 0,
            totalTokens: inputTokens,
            cost: 0,
        };
    }
}

/**
 * Doubt Solver - Explain concepts and solve problems
 */
export async function solveDoubt(question: string, context?: {
    subject?: string;
    topic?: string;
    difficulty?: string;
}): Promise<{
    success: boolean;
    answer?: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
    error?: string;
}> {
    const systemPrompt = `You are an expert tutor specializing in ${context?.subject || 'academic subjects'}.
Your role is to:
1. Provide clear, accurate explanations
2. Break down complex concepts into simple steps
3. Use examples where helpful
4. Encourage understanding, not just answers

${context?.difficulty ? `Student level: ${context.difficulty}` : ''}
${context?.topic ? `Topic: ${context.topic}` : ''}

Provide a helpful, educational response that aids learning.`;

    return await generateAIResponse(question, systemPrompt, {
        temperature: 0.7,
        maxOutputTokens: 800,
    });
}

/**
 * Performance Coach - Analyze user performance and give advice
 */
export async function analyzePerformance(performanceData: {
    totalAttempts: number;
    correctAnswers: number;
    incorrectAnswers: number;
    averageScore: number;
    weakTopics?: string[];
    strongTopics?: string[];
    recentTrend?: 'improving' | 'declining' | 'stable';
}): Promise<{
    success: boolean;
    analysis?: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
    error?: string;
}> {
    const accuracy = (performanceData.correctAnswers / performanceData.totalAttempts * 100).toFixed(1);

    const prompt = `Analyze this student's performance and provide personalized coaching advice:

Performance Summary:
- Total Attempts: ${performanceData.totalAttempts}
- Correct: ${performanceData.correctAnswers}
- Incorrect: ${performanceData.incorrectAnswers}
- Accuracy: ${accuracy}%
- Average Score: ${performanceData.averageScore}%
${performanceData.recentTrend ? `- Recent Trend: ${performanceData.recentTrend}` : ''}
${performanceData.weakTopics?.length ? `- Weak Topics: ${performanceData.weakTopics.join(', ')}` : ''}
${performanceData.strongTopics?.length ? `- Strong Topics: ${performanceData.strongTopics.join(', ')}` : ''}

Provide:
1. Performance analysis
2. Specific actionable advice
3. Study recommendations
4. Motivation and encouragement`;

    const systemPrompt = `You are an AI performance coach helping students improve their academic performance.
Provide constructive, motivating feedback with specific, actionable recommendations.
Focus on growth mindset and practical study strategies.`;

    return await generateAIResponse(prompt, systemPrompt, {
        temperature: 0.8,
        maxOutputTokens: 600,
    });
}

/**
 * Validate prompt for safety (basic check)
 */
export function validatePrompt(prompt: string): {
    valid: boolean;
    reason?: string;
} {
    if (!prompt || prompt.trim().length === 0) {
        return { valid: false, reason: 'Prompt cannot be empty' };
    }

    if (prompt.length > 5000) {
        return { valid: false, reason: 'Prompt too long (max 5000 characters)' };
    }

    // Basic safety check (can be enhanced)
    const blockedPatterns = [
        /system.*override/i,
        /ignore.*instructions/i,
        /jailbreak/i,
    ];

    for (const pattern of blockedPatterns) {
        if (pattern.test(prompt)) {
            return { valid: false, reason: 'Prompt contains prohibited content' };
        }
    }

    return { valid: true };
}
