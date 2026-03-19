/**
 * Base Model Adapter
 * Handles common functionality like caching, cost estimation, and API call management
 * Delegates model-specific logic to the individual adapters
 */

import { AIModelDefinition, getModelById } from './models';
import { adapters } from './adapters';
import { AIModel, AIModelAdapterResponse, AIModelBaseAdapter, AIModelCostEstimate, Usage } from './types';
import { countTokens } from './utils/tokenizer';
import { getPricePer1K } from './price';
import { addAIUsageRecord } from '../ai-usage-monitoring';


export class AIModelAdapter implements AIModelBaseAdapter {
  modelId: string;
  modelDefinition: AIModelDefinition;
  modelAdapter: AIModel;
  
  constructor(modelId: string) {
    this.modelId = modelId;
    this.modelDefinition = getModelById(modelId);
    this.modelAdapter = adapters[this.modelDefinition.provider]();
  }

  private calculateCost(usage: Usage): AIModelCostEstimate {
    const inputCost = (usage.promptTokens / 1000) * getPricePer1K(this.modelId, usage.promptTokens).inputCost;
    const outputCost = (usage.completionTokens / 1000) * getPricePer1K(this.modelId, usage.completionTokens).outputCost;
    const totalCost = inputCost + outputCost;
    return { totalCost };
  }
  
  /**
   * Estimate cost based on input text and expected output
   * Uses common logic but delegates model-specific details to the specific adapter
   */
  estimateCost(
    prompt: string, 
    expectedOutputTokens?: number
  ): AIModelCostEstimate {
    
    // Count input tokens using the appropriate tokenizer
    const promptTokens = countTokens(prompt, this.modelDefinition.provider, this.modelId);
    
    // Calculate input cost based on actual token count
    const inputCost = (promptTokens / 1000) * getPricePer1K(this.modelId, promptTokens).inputCost;
    
    // Calculate output cost based on expected output tokens (if provided)
    const outputTokens = expectedOutputTokens || Math.ceil(promptTokens / 2); // Estimate output tokens if not provided
    const outputCost = (outputTokens / 1000) * getPricePer1K(this.modelId, outputTokens).outputCost;
    
    const totalCost = inputCost + outputCost;
    return { totalCost };
  }
  
  /**
   * Process a prompt and return plain text
   * Handles caching and cost tracking, delegating the actual API call to the specific adapter
   */
  async processPromptToText(
    prompt: string,
    endpoint: string = 'unknown'
  ): Promise<AIModelAdapterResponse<string>> {

    const response = await this.modelAdapter.processPromptToText(prompt, this.modelId);
    const cost = this.calculateCost(response.usage);
    
    // Track AI usage
    try {
      await addAIUsageRecord(
        this.modelId,
        this.modelDefinition,
        response.usage,
        cost.totalCost,
        endpoint
      );
    } catch (error) {
      console.error('Error tracking AI usage:', error);
      // Continue even if tracking fails
    }
    
    return {
      result: response.result,
      usage: response.usage,
      cost: cost
    };
  }

  /**
   * Process a prompt and return parsed JSON of type T
   * Handles caching and cost tracking, delegating the actual API call to the specific adapter
   */
  async processPromptToJSON<T>(
    prompt: string,
    endpoint: string = 'unknown'
  ): Promise<AIModelAdapterResponse<T>> {

    const response = await this.modelAdapter.processPromptToJSON<T>(prompt, this.modelId);
    const cost = this.calculateCost(response.usage);
    
    // Track AI usage
    try {
      await addAIUsageRecord(
        this.modelId,
        this.modelDefinition,
        response.usage,
        cost.totalCost,
        endpoint
      );
    } catch (error) {
      console.error('Error tracking AI usage:', error);
      // Continue even if tracking fails
    }
    
    return {
      result: response.result,
      usage: response.usage,
      cost: cost
    };
  }
}
