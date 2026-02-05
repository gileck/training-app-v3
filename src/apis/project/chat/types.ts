// Shared types between client and server for the chat API

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
  usage: Usage
}

/**
 * Combined model response with result and cost information
 */
export type AIModelAdapterResponse<T> = AIModelResponse<T> & AIModelBaseResponse;

// Chat API specific types
export type ChatRequest = {
  modelId: string;
  text: string;
};

export type ChatResponse = {
  result: string;
  cost: {
    totalCost: number;
  };
  error?: string;
};
