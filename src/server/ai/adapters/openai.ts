import OpenAI from 'openai';
import { 
  AIModelResponse,
  AIModel,
} from '../types';
import { getModelById } from '../models';

export class OpenAIAdapter implements AIModel {
  private openai: OpenAI;
  static provider = 'openai';
  
  constructor() {
    // Get API key from environment variable
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenAI API key not found in environment variables');
    }
    
    this.openai = new OpenAI({ apiKey });
  }
  
  
  // Make an API call to the OpenAI model and return plain text
  async processPromptToText(
    prompt: string,
    modelId: string,
  ): Promise<AIModelResponse<string>> {
    // Get model by ID for cost calculation
    const model = getModelById(modelId);
    
    // Make the API call
    const response = await this.openai.chat.completions.create({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7, // Default temperature
      max_tokens: Math.min(model.maxTokens, 2000),
      top_p: 1, // Default top_p
      frequency_penalty: 0, // Default frequency_penalty
      presence_penalty: 0 // Default presence_penalty
    });
    
    // Extract usage information
    const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    
    // Get the response text
    const responseText = response.choices[0]?.message?.content || '';
    
    // Return the formatted response
    return {
      result: responseText,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens
      },
    };
  }

  // Make an API call to the OpenAI model and return parsed JSON
  async processPromptToJSON<T>(
    prompt: string,
    modelId: string,
  ): Promise<AIModelResponse<T>> {
    // Get model by ID for cost calculation
    const model = getModelById(modelId);
    
    // Make the API call
    const response = await this.openai.chat.completions.create({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7, // Default temperature
      max_tokens: Math.min(model.maxTokens, 2000),
      top_p: 1, // Default top_p
      frequency_penalty: 0, // Default frequency_penalty
      presence_penalty: 0, // Default presence_penalty
      response_format: { type: 'json_object' } // Always set for JSON responses
    });
    
    // Extract usage information
    const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    
    // Get the response text
    const responseText = response.choices[0]?.message?.content || '';
    
    // Parse JSON
    let json: T;
    try {
      json = JSON.parse(responseText) as T;
    } catch (error) {
      console.error('Failed to parse JSON response from OpenAI: ', {
        error, 
        responseText
      });
      throw new Error('Failed to parse JSON response from OpenAI API');
    }
    
    // Return the formatted response
    return {
      result: json,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens
      },
    };
  }
}
