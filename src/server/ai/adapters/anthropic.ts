import Anthropic from '@anthropic-ai/sdk';
import { 
  AIModelResponse,
  AIModel,
} from '../types';
import { getModelById } from '../models';

export class AnthropicAdapter implements AIModel {
  private anthropic: Anthropic;
  static provider = 'anthropic';
  
  constructor() {
    // Get API key from environment variable
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      throw new Error('Anthropic API key not found in environment variables');
    }
    
    this.anthropic = new Anthropic({ apiKey });
  }
  
  
  // Make an API call to the Anthropic model and return plain text
  async processPromptToText(
    prompt: string,
    modelId: string,
  ): Promise<AIModelResponse<string>> {
    // Get model by ID for cost calculation
    const model = getModelById(modelId);
    
    // Make the API call
    const response = await this.anthropic.messages.create({
      model: modelId,
      max_tokens: Math.min(model.maxTokens, 4096),
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });
    
    // Extract usage information
    const usage = response.usage || { input_tokens: 0, output_tokens: 0 };
    
    // Get the response text from the content blocks
    const responseText = response.content
      .filter(block => block.type === 'text')
      .map(block => 'text' in block ? block.text : '')
      .join('');
    
    // Return the formatted response
    return {
      result: responseText,
      usage: {
        promptTokens: usage.input_tokens,
        completionTokens: usage.output_tokens,
        totalTokens: usage.input_tokens + usage.output_tokens
      },
    };
  }

  // Make an API call to the Anthropic model and return parsed JSON
  async processPromptToJSON<T>(
    prompt: string,
    modelId: string,
  ): Promise<AIModelResponse<T>> {
    // Get model by ID for cost calculation
    const model = getModelById(modelId);
    
    // Append instruction to return JSON format
    const jsonPrompt = `${prompt}\n\nPlease respond with valid JSON only, no additional text.`;
    
    // Make the API call
    const response = await this.anthropic.messages.create({
      model: modelId,
      max_tokens: Math.min(model.maxTokens, 4096),
      messages: [{ role: 'user', content: jsonPrompt }],
      temperature: 0.7,
    });
    
    // Extract usage information
    const usage = response.usage || { input_tokens: 0, output_tokens: 0 };
    
    // Get the response text from the content blocks
    const responseText = response.content
      .filter(block => block.type === 'text')
      .map(block => 'text' in block ? block.text : '')
      .join('');
    
    // Parse JSON
    let json: T;
    try {
      json = JSON.parse(responseText) as T;
    } catch (error) {
      console.error('Failed to parse JSON response from Anthropic: ', {
        error, 
        responseText
      });
      throw new Error('Failed to parse JSON response from Anthropic API');
    }
    
    // Return the formatted response
    return {
      result: json,
      usage: {
        promptTokens: usage.input_tokens,
        completionTokens: usage.output_tokens,
        totalTokens: usage.input_tokens + usage.output_tokens
      },
    };
  }
}

