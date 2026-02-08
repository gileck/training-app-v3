import { GoogleGenAI } from '@google/genai';
import {
  AIModel,
  AIModelResponse,
  Usage
} from '../types';

export class GeminiAdapter implements AIModel {
  static provider = 'gemini';
  private genAI: GoogleGenAI;
  private static readonly defaultConfig = { maxOutputTokens: 65536, temperature: 0.7 } as const;

  constructor() {
    // Get API key from environment variable
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('Gemini API key not found in environment variables');
    }

    this.genAI = new GoogleGenAI({ apiKey });
  }

  private calcUsage(response: unknown): Usage {
    const usage = (response as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } }).usageMetadata;
    return {
      promptTokens: usage?.promptTokenCount || 0,
      completionTokens: usage?.candidatesTokenCount || 0,
      totalTokens: usage?.totalTokenCount || 0,
    };
  }

  private async generate(
    modelId: string,
    contents: string,
    config?: Partial<{ maxOutputTokens: number; temperature: number; responseMimeType?: string }>
  ) {
    return this.genAI.models.generateContent({
      model: modelId,
      contents,
      config: {
        ...GeminiAdapter.defaultConfig,
        ...config,
      },
    });
  }
  
  // Make an API call to the Gemini model and return plain text
  async processPromptToText(
    prompt: string,
    modelId: string,
  ): Promise<AIModelResponse<string>> {
    try {
      const result = await this.generate(modelId, prompt);
      const responseText = (result as { text?: string }).text ?? '';
      return {
        result: responseText,
        usage: this.calcUsage(result),
      };
    } catch (error) {
      console.error('Gemini API call failed:', error);
      throw error;
    }
  }

  // Make an API call to the Gemini model and return parsed JSON
  async processPromptToJSON<T>(
    prompt: string,
    modelId: string,
  ): Promise<AIModelResponse<T>> {
    try {
      const result = await this.generate(modelId, prompt, { responseMimeType: 'application/json' });
      const responseText = (result as { text?: string }).text ?? '';
      // Parse JSON
      let json: T;
      try {
        json = JSON.parse(responseText) as T;
      } catch (e) {
        console.error('Failed to parse JSON response:', e);
        throw new Error('Failed to parse JSON response from Gemini API');
      }
      // Return the formatted response
      return {
        result: json,
        usage: this.calcUsage(result),
      };
    } catch (error) {
      console.error('Gemini API call failed:', error);
      throw error;
    }
  }
}
