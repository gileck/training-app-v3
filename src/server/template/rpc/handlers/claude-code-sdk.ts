import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';

const MODEL_MAP: Record<string, string> = {
  'claude-code-haiku': 'claude-haiku-4-5-20251001',
  'claude-code-sonnet': 'claude-sonnet-4-5-20250929',
  'claude-code-opus': 'claude-opus-4-6',
};

export default async function handleClaudeCodeSdk(args: Record<string, unknown>) {
  const { prompt, modelId, systemPrompt } = args;
  if (typeof prompt !== 'string' || typeof modelId !== 'string') {
    throw new Error('claude-code-sdk handler requires string "prompt" and "modelId" args');
  }

  const actualModel = MODEL_MAP[modelId];
  if (!actualModel) {
    throw new Error(`Unknown claude-code model ID: ${modelId}`);
  }

  const resolvedSystemPrompt = typeof systemPrompt === 'string' ? systemPrompt : 'You are a helpful assistant.';

  const stream = query({
    prompt,
    options: {
      model: actualModel,
      tools: [],
      maxTurns: 1,
      persistSession: false,
      systemPrompt: resolvedSystemPrompt,
      permissionMode: 'dontAsk',
    }
  });

  let resultMessage: SDKResultMessage | null = null;
  for await (const message of stream) {
    if (message.type === 'result') {
      resultMessage = message as SDKResultMessage;
    }
  }

  if (!resultMessage) {
    throw new Error('No result message received from Claude Code SDK');
  }

  if (resultMessage.subtype !== 'success') {
    const errors = 'errors' in resultMessage && Array.isArray(resultMessage.errors)
      ? resultMessage.errors.join('; ')
      : 'unknown error';
    throw new Error(`Claude Code SDK error: ${errors}`);
  }

  // Extract per-model usage from modelUsage
  const modelUsageEntries = resultMessage.modelUsage
    ? Object.values(resultMessage.modelUsage)
    : [];
  const inputTokens = modelUsageEntries.reduce((sum, m) => sum + (m.inputTokens ?? 0), 0);
  const outputTokens = modelUsageEntries.reduce((sum, m) => sum + (m.outputTokens ?? 0), 0);

  return {
    result: resultMessage.result,
    usage: {
      promptTokens: inputTokens,
      completionTokens: outputTokens,
      totalTokens: inputTokens + outputTokens,
    },
  };
}
