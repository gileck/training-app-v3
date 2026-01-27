/**
 * Token Pricing Configuration
 *
 * Rough estimates for cost calculation when CLI tools don't provide cost.
 * These are approximate rates - actual costs may vary.
 *
 * Last updated: January 2026
 */

export interface ModelPricing {
    inputPer1kTokens: number;   // USD per 1,000 input tokens
    outputPer1kTokens: number;  // USD per 1,000 output tokens
}

/**
 * Pricing by model name (rough estimates)
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
    // Gemini models
    'gemini-3-flash-preview': {
        inputPer1kTokens: 0.0001,    // $0.10 per 1M (estimate)
        outputPer1kTokens: 0.0004,   // $0.40 per 1M (estimate)
    },
    'gemini-2.5-pro': {
        inputPer1kTokens: 0.00025,   // $0.25 per 1M
        outputPer1kTokens: 0.001,    // $1.00 per 1M
    },
    'gemini-2.5-flash': {
        inputPer1kTokens: 0.000075,  // $0.075 per 1M
        outputPer1kTokens: 0.0003,   // $0.30 per 1M
    },
    'gemini-2.0-flash': {
        inputPer1kTokens: 0.0001,    // $0.10 per 1M
        outputPer1kTokens: 0.0004,   // $0.40 per 1M
    },

    // OpenAI Codex models (rough estimates)
    'gpt-5-codex': {
        inputPer1kTokens: 0.005,     // $5.00 per 1M (estimate)
        outputPer1kTokens: 0.015,    // $15.00 per 1M (estimate)
    },
    'gpt-5': {
        inputPer1kTokens: 0.005,     // $5.00 per 1M (estimate)
        outputPer1kTokens: 0.015,    // $15.00 per 1M (estimate)
    },
    'gpt-4o': {
        inputPer1kTokens: 0.0025,    // $2.50 per 1M
        outputPer1kTokens: 0.01,     // $10.00 per 1M
    },

    // Claude models (for reference - SDK provides actual cost)
    'claude-sonnet-4-20250514': {
        inputPer1kTokens: 0.003,     // $3.00 per 1M
        outputPer1kTokens: 0.015,    // $15.00 per 1M
    },
    'claude-opus-4-20250514': {
        inputPer1kTokens: 0.015,     // $15.00 per 1M
        outputPer1kTokens: 0.075,    // $75.00 per 1M
    },
};

/**
 * Calculate estimated cost from token counts
 */
export function calculateCost(
    modelName: string,
    inputTokens: number,
    outputTokens: number
): number {
    // Try exact match first
    let pricing = MODEL_PRICING[modelName];

    // If not found, try partial match
    if (!pricing) {
        const lowerModel = modelName.toLowerCase();
        for (const [key, value] of Object.entries(MODEL_PRICING)) {
            if (lowerModel.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerModel)) {
                pricing = value;
                break;
            }
        }
    }

    // Default to a conservative estimate if no pricing found
    if (!pricing) {
        pricing = {
            inputPer1kTokens: 0.001,   // $1.00 per 1M
            outputPer1kTokens: 0.003,  // $3.00 per 1M
        };
    }

    const inputCost = (inputTokens / 1000) * pricing.inputPer1kTokens;
    const outputCost = (outputTokens / 1000) * pricing.outputPer1kTokens;

    return inputCost + outputCost;
}
