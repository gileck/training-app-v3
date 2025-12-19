/**
 * AI model types for server-side implementation
 */

// Import shared types from the chat API types file
import type {
  AIModelCostEstimate,
  AIModelBaseResponse,
  Usage,
  AIModelResponse,
  AIModelAdapterResponse
} from '../../apis/chat/types';

// Re-export the shared types
export type {
  AIModelCostEstimate,
  AIModelBaseResponse,
  Usage,
  AIModelResponse,
  AIModelAdapterResponse
};

/**
 * AI model adapter interface
 * Defines the contract for all AI model adapters
 */
export interface AIModel {
  processPromptToText: (
    prompt: string,
    modelId: string,
  ) => Promise<AIModelResponse<string>>;
  processPromptToJSON: <T>(
    prompt: string,
    modelId: string,
  ) => Promise<AIModelResponse<T>>;
}

export interface AIModelBaseAdapter {
  estimateCost: (
    prompt: string,
    expectedOutputTokens?: number
  ) => AIModelCostEstimate

  processPromptToText: (
    prompt: string,
    modelId: string,
  ) => Promise<AIModelAdapterResponse<string>>;
  processPromptToJSON: <T>(
    prompt: string,
    modelId: string,
  ) => Promise<AIModelAdapterResponse<T>>;
}



