import { callRemote } from '@/server/template/rpc/client';
import type { AIModel, AIModelResponse } from '../types';

const HANDLER_PATH = 'src/server/template/rpc/handlers/claude-code-sdk';

interface ClaudeCodeRpcResult {
  result: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class ClaudeCodeAdapter implements AIModel {
  static provider = 'claude-code';

  async processPromptToText(
    prompt: string,
    modelId: string,
  ): Promise<AIModelResponse<string>> {
    const { data } = await callRemote<ClaudeCodeRpcResult>(
      HANDLER_PATH,
      { prompt, modelId },
      { skipCache: true, timeoutMs: 120_000 }
    );

    return {
      result: data.result,
      usage: data.usage,
    };
  }

  async processPromptToJSON<T>(
    prompt: string,
    modelId: string,
  ): Promise<AIModelResponse<T>> {
    const jsonPrompt = `${prompt}\n\nPlease respond with valid JSON only, no additional text.`;

    const { data } = await callRemote<ClaudeCodeRpcResult>(
      HANDLER_PATH,
      { prompt: jsonPrompt, modelId },
      { skipCache: true, timeoutMs: 120_000 }
    );

    let parsed: T;
    try {
      parsed = JSON.parse(data.result) as T;
    } catch (error) {
      console.error('Failed to parse JSON response from Claude Code SDK:', {
        error,
        result: data.result,
      });
      throw new Error('Failed to parse JSON response from Claude Code SDK');
    }

    return {
      result: parsed,
      usage: data.usage,
    };
  }
}
