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
  // Google Gemini (Dec 2025)
  {
    model_id: 'gemini-2.5-flash',
    input_cost_per_1k: 0.0003,   // $0.30 per 1M
    output_cost_per_1k: 0.0025   // $2.50 per 1M
  },
  {
    model_id: 'gemini-2.5-pro',
    input_cost_per_1k: 0.00125,  // $1.25 per 1M
    output_cost_per_1k: 0.005    // $5.00 per 1M
  },
  
  // OpenAI (Dec 2025)
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
  {
    model_id: 'o1',
    input_cost_per_1k: 0.015,    // $15 per 1M
    output_cost_per_1k: 0.06     // $60 per 1M
  },
  {
    model_id: 'o1-mini',
    input_cost_per_1k: 0.003,    // $3 per 1M
    output_cost_per_1k: 0.012    // $12 per 1M
  },
  
  // Anthropic Claude (Dec 2025)
  {
    model_id: 'claude-3-5-sonnet-20241022',
    input_cost_per_1k: 0.003,    // $3 per 1M
    output_cost_per_1k: 0.015    // $15 per 1M
  },
  {
    model_id: 'claude-3-5-haiku-20241022',
    input_cost_per_1k: 0.001,    // $1 per 1M
    output_cost_per_1k: 0.005    // $5 per 1M
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
