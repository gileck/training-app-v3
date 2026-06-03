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

    const parsed = parseJsonLeniently<T>(data.result);
    if (!parsed.ok) {
      console.error('Failed to parse JSON response from Claude Code SDK:', {
        error: parsed.error,
        result: data.result,
      });
      throw new Error('Failed to parse JSON response from Claude Code SDK');
    }

    return {
      result: parsed.value,
      usage: data.usage,
    };
  }
}

/**
 * The Claude Code SDK's output often arrives wrapped in markdown fences
 * (```json ... ```) or with a sentence of explanatory prose around the
 * JSON object — strict JSON.parse fails on both even though the actual
 * JSON inside is perfectly valid. Walk the string from the outside in:
 *   1. trim
 *   2. strip a leading ```/```json fence and a trailing ```
 *   3. if that still fails, extract the first `{` … last `}` and try that
 */
function parseJsonLeniently<T>(
  raw: string
): { ok: true; value: T } | { ok: false; error: unknown } {
  const trimmed = raw.trim();

  const candidates: string[] = [trimmed];

  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i);
  if (fenceMatch) candidates.push(fenceMatch[1].trim());

  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) {
    candidates.push(trimmed.slice(first, last + 1));
  }

  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      return { ok: true, value: JSON.parse(candidate) as T };
    } catch (err) {
      lastError = err;
    }
  }
  return { ok: false, error: lastError };
}
