/**
 * Shared model definitions for AI providers
 * These types are used by both client and server code
 * 
 * Updated: December 2025
 */

export interface AIModelDefinition {
  id: string;
  name: string;
  provider: 'gemini' | 'openai' | 'anthropic';
  maxTokens: number;
  capabilities: string[];
}

// Google Gemini models (Dec 2025)
export const GEMINI_MODELS: AIModelDefinition[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    maxTokens: 1048576, // 1M context
    capabilities: ['fast-responses', 'low-latency', 'reasoning', 'multimodal']
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    maxTokens: 1048576,
    capabilities: ['reasoning', 'analysis', 'coding', 'multimodal']
  }
];

// OpenAI models (Dec 2025)
export const OPENAI_MODELS: AIModelDefinition[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    maxTokens: 128000,
    capabilities: ['reasoning', 'multimodal', 'coding', 'analysis']
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    maxTokens: 128000,
    capabilities: ['fast-responses', 'coding', 'summarization']
  },
  {
    id: 'o1',
    name: 'o1',
    provider: 'openai',
    maxTokens: 200000,
    capabilities: ['deep-reasoning', 'complex-analysis', 'coding']
  },
  {
    id: 'o1-mini',
    name: 'o1 Mini',
    provider: 'openai',
    maxTokens: 128000,
    capabilities: ['reasoning', 'coding', 'math']
  }
];

// Anthropic Claude models (Dec 2025)
export const ANTHROPIC_MODELS: AIModelDefinition[] = [
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    maxTokens: 200000,
    capabilities: ['reasoning', 'coding', 'analysis', 'writing']
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    maxTokens: 200000,
    capabilities: ['fast-responses', 'coding', 'summarization']
  }
];

// Helper functions
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
