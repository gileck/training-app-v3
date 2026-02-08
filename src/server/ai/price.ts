/**
 * AI Model Pricing (Updated: December 2025)
 * Prices are per 1K tokens
 */

type PricingModel = {
  model_id: string;
  input_cost_per_1k: number;
  output_cost_per_1k: number;
}

export const pricing: PricingModel[] = [
  // Google Gemini (Feb 2026)
  {
    model_id: 'gemini-2.5-flash-lite',
    input_cost_per_1k: 0.0001,   // $0.10 per 1M
    output_cost_per_1k: 0.0004   // $0.40 per 1M
  },
  {
    model_id: 'gemini-3-flash-preview',
    input_cost_per_1k: 0.0005,   // $0.50 per 1M
    output_cost_per_1k: 0.003    // $3.00 per 1M
  },
  {
    model_id: 'gemini-3-pro-preview',
    input_cost_per_1k: 0.002,    // $2.00 per 1M
    output_cost_per_1k: 0.012    // $12.00 per 1M
  },
  
  // OpenAI (Feb 2026)
  {
    model_id: 'gpt-5',
    input_cost_per_1k: 0.00125,  // $1.25 per 1M
    output_cost_per_1k: 0.01     // $10 per 1M
  },
  {
    model_id: 'gpt-5-pro',
    input_cost_per_1k: 0.015,    // $15 per 1M
    output_cost_per_1k: 0.12     // $120 per 1M
  },
  {
    model_id: 'gpt-5-mini',
    input_cost_per_1k: 0.00025,  // $0.25 per 1M
    output_cost_per_1k: 0.002    // $2 per 1M
  },
  {
    model_id: 'gpt-4o',
    input_cost_per_1k: 0.0025,   // $2.50 per 1M
    output_cost_per_1k: 0.01     // $10 per 1M
  },
  {
    model_id: 'gpt-4o-mini',
    input_cost_per_1k: 0.00015,  // $0.15 per 1M
    output_cost_per_1k: 0.0006   // $0.60 per 1M
  },
  
  // Anthropic Claude (Feb 2026)
  {
    model_id: 'claude-haiku-4-5-20251001',
    input_cost_per_1k: 0.001,    // $1 per 1M
    output_cost_per_1k: 0.005    // $5 per 1M
  },
  {
    model_id: 'claude-sonnet-4-5-20250929',
    input_cost_per_1k: 0.003,    // $3 per 1M
    output_cost_per_1k: 0.015    // $15 per 1M
  },
  {
    model_id: 'claude-opus-4-6',
    input_cost_per_1k: 0.005,    // $5 per 1M
    output_cost_per_1k: 0.025    // $25 per 1M
  },
];

export function getPricePer1K(modelId: string, _tokens?: number): {
  inputCost: number;
  outputCost: number;
} {
  const model = pricing.find(m => m.model_id === modelId);
  if (!model) {
    throw new Error(`Pricing not found for model: ${modelId}`);
  }
  return {
    inputCost: model.input_cost_per_1k,
    outputCost: model.output_cost_per_1k
  };
}
