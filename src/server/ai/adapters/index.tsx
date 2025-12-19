import { GeminiAdapter } from './gemini';
import { OpenAIAdapter } from './openai';
import { AnthropicAdapter } from './anthropic';
import { AIModel } from '../types';

// Export adapter classes by provider
export const adapters: Record<string, () => AIModel> = { 
    [GeminiAdapter.provider]: () => new GeminiAdapter(),
    [OpenAIAdapter.provider]: () => new OpenAIAdapter(),
    [AnthropicAdapter.provider]: () => new AnthropicAdapter()
}