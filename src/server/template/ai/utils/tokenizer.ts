/**
 * Tokenizer utilities for AI models
 * Provides accurate token counting for different AI providers
 */
import { encoding_for_model, TiktokenModel } from 'tiktoken';



/**
 * Count tokens for OpenAI models using tiktoken
 * @param text Text to count tokens for
 * @param modelId OpenAI model ID
 * @returns Number of tokens
 */
export function countOpenAITokens(text: string, modelId?: string): number {
  try {
    const tiktokenModel = modelId as TiktokenModel || 'gpt-3.5-turbo' as TiktokenModel;
    const encoder = encoding_for_model(tiktokenModel);
    const tokens = encoder.encode(text);
    const count = tokens.length;
    encoder.free();
    return count;
  } catch (error) {
    console.warn(`Error counting tokens for model ${modelId}, falling back to estimate`, error);
    // Fallback to approximation
    return Math.ceil(text.length / 4);
  }
}

/**
 * Count tokens for Gemini models
 * Since there's no official tokenizer for Gemini, we use an approximation
 * based on OpenAI's cl100k_base encoding which is similar
 * @param text Text to count tokens for
 * @returns Number of tokens
 */
export function countGeminiTokens(text: string): number {
  try {
    // Use cl100k_base encoding which is similar to what Gemini uses
    const encoder = encoding_for_model('gpt-4' as TiktokenModel);
    const tokens = encoder.encode(text);
    const count = tokens.length;
    encoder.free();
    return count;
  } catch (error) {
    console.warn('Error counting Gemini tokens, falling back to estimate', error);
    // Fallback to approximation
    return Math.ceil(text.length / 3.5);
  }
}

/**
 * Count tokens based on provider and model
 * @param text Text to count tokens for
 * @param provider AI provider (openai, google)
 * @param modelId Model ID
 * @returns Number of tokens
 */
export function countTokens(text: string, provider: string, modelId: string): number {
  if (provider === 'openai') {
    return countOpenAITokens(text, modelId);
  } else if (provider === 'google') {
    return countGeminiTokens(text);
  } 
  return countOpenAITokens(text);
}
