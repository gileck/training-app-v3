/**
 * AI model types for server-side implementation
 */

/**
 * Cost estimate for an AI model operation
 */
export interface AIModelCostEstimate {
  totalCost: number;
}

/**
 * AI usage metrics
 */
export type Usage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Base response with usage and cost information
 */
export interface AIModelBaseResponse {
  cost: {
    totalCost: number;
  };
}

/**
 * Generic AI model response type
 */
export type AIModelResponse<T> = {
  result: T;
  usage: Usage;
}

/**
 * Combined model response with result and cost information
 */
export type AIModelAdapterResponse<T> = AIModelResponse<T> & AIModelBaseResponse;

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



