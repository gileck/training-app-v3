/**
 * Shared model definitions for AI providers
 * These types are used by both client and server code
 * 
 * Updated: December 2025
 */

export type ModelTier = 'Budget' | 'Pro' | 'Premium';

export interface AIModelDefinition {
  id: string;
  name: string;
  provider: 'gemini' | 'openai' | 'anthropic';
  tier: ModelTier;
  maxTokens: number;
  maxOutputTokens: number;
  /** Price per 1M input tokens in USD */
  inputPricePer1M: number;
  /** Price per 1M output tokens in USD */
  outputPricePer1M: number;
  capabilities: string[];
}

// Google Gemini models (Feb 2026)
export const GEMINI_MODELS: AIModelDefinition[] = [
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    provider: 'gemini',
    tier: 'Budget',
    maxTokens: 1048576, // 1M context
    maxOutputTokens: 65536,
    inputPricePer1M: 0.10,
    outputPricePer1M: 0.40,
    capabilities: ['fast-responses', 'low-latency', 'cost-efficient']
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash',
    provider: 'gemini',
    tier: 'Budget',
    maxTokens: 1048576,
    maxOutputTokens: 65536,
    inputPricePer1M: 0.50,
    outputPricePer1M: 3.00,
    capabilities: ['fast-responses', 'low-latency', 'reasoning', 'multimodal']
  },
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro',
    provider: 'gemini',
    tier: 'Premium',
    maxTokens: 1048576,
    maxOutputTokens: 65536,
    inputPricePer1M: 2.00,
    outputPricePer1M: 12.00,
    capabilities: ['reasoning', 'analysis', 'coding', 'multimodal']
  }
];

// OpenAI models (Feb 2026)
export const OPENAI_MODELS: AIModelDefinition[] = [
  {
    id: 'gpt-5',
    name: 'GPT-5',
    provider: 'openai',
    tier: 'Pro',
    maxTokens: 400000,
    maxOutputTokens: 128000,
    inputPricePer1M: 1.25,
    outputPricePer1M: 10.00,
    capabilities: ['reasoning', 'multimodal', 'coding', 'analysis']
  },
  {
    id: 'gpt-5-pro',
    name: 'GPT-5 Pro',
    provider: 'openai',
    tier: 'Premium',
    maxTokens: 400000,
    maxOutputTokens: 128000,
    inputPricePer1M: 15.00,
    outputPricePer1M: 120.00,
    capabilities: ['deep-reasoning', 'complex-analysis', 'coding', 'multimodal']
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'openai',
    tier: 'Budget',
    maxTokens: 400000,
    maxOutputTokens: 128000,
    inputPricePer1M: 0.25,
    outputPricePer1M: 2.00,
    capabilities: ['fast-responses', 'coding', 'summarization']
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    tier: 'Pro',
    maxTokens: 128000,
    maxOutputTokens: 16384,
    inputPricePer1M: 2.50,
    outputPricePer1M: 10.00,
    capabilities: ['reasoning', 'multimodal', 'coding', 'analysis']
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    tier: 'Budget',
    maxTokens: 128000,
    maxOutputTokens: 16384,
    inputPricePer1M: 0.15,
    outputPricePer1M: 0.60,
    capabilities: ['fast-responses', 'coding', 'summarization']
  }
];

// Anthropic Claude models (Feb 2026)
export const ANTHROPIC_MODELS: AIModelDefinition[] = [
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    tier: 'Budget',
    maxTokens: 200000,
    maxOutputTokens: 64000,
    inputPricePer1M: 1.00,
    outputPricePer1M: 5.00,
    capabilities: ['fast-responses', 'coding', 'summarization']
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    tier: 'Pro',
    maxTokens: 200000,
    maxOutputTokens: 64000,
    inputPricePer1M: 3.00,
    outputPricePer1M: 15.00,
    capabilities: ['reasoning', 'coding', 'analysis', 'writing']
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    tier: 'Premium',
    maxTokens: 200000,
    maxOutputTokens: 128000,
    inputPricePer1M: 5.00,
    outputPricePer1M: 25.00,
    capabilities: ['deep-reasoning', 'coding', 'analysis', 'writing', 'multimodal']
  }
];

// Helper functions
export const DEFAULT_MODEL_ID = 'gemini-2.5-flash-lite';

export function getAllModels(): AIModelDefinition[] {
  return [...GEMINI_MODELS, ...OPENAI_MODELS, ...ANTHROPIC_MODELS];
}

export function getModelsByProvider(provider: string): AIModelDefinition[] {
  return getAllModels().filter(model => model.provider === provider);
}

export function getModelById(modelId: string): AIModelDefinition {
  const model = getAllModels().find(model => model.id === modelId);
  if (!model) {
    throw new Error(`Model not found: ${modelId}`);
  }
  return model;
}

export function isModelExists(modelId: string): boolean {
  return getAllModels().some(model => model.id === modelId);
}

const TIER_ORDER: ModelTier[] = ['Budget', 'Pro', 'Premium'];

export function getModelsByTier(): { tier: ModelTier; models: AIModelDefinition[] }[] {
  const all = getAllModels();
  return TIER_ORDER
    .map(tier => ({
      tier,
      models: all
        .filter(m => m.tier === tier)
        .sort((a, b) => a.inputPricePer1M - b.inputPricePer1M),
    }))
    .filter(group => group.models.length > 0);
}
