import path from 'path';
import { spawn } from 'child_process';

const MODEL_MAP: Record<string, string> = {
  'gpt-5-codex': 'gpt-5-codex',
  'gpt-5.4': 'gpt-5.4',
};

type CodexUsage = {
  input_tokens?: number;
  output_tokens?: number;
};

type CodexItemCompletedEvent = {
  type: 'item.completed';
  item?: {
    type?: string;
    text?: string;
  };
};

type CodexTurnCompletedEvent = {
  type: 'turn.completed';
  usage?: CodexUsage;
};

type CodexEvent = CodexItemCompletedEvent | CodexTurnCompletedEvent | { type?: string };

const CODEX_BIN = path.resolve(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'codex.cmd' : 'codex'
);
const EXEC_TIMEOUT_MS = 120_000;

function buildPrompt(prompt: string, systemPrompt?: string): string {
  if (!systemPrompt?.trim()) {
    return prompt;
  }

  return `System instructions:\n${systemPrompt.trim()}\n\nUser prompt:\n${prompt}`;
}

function isItemCompletedEvent(event: CodexEvent): event is CodexItemCompletedEvent {
  return event.type === 'item.completed';
}

function isTurnCompletedEvent(event: CodexEvent): event is CodexTurnCompletedEvent {
  return event.type === 'turn.completed';
}

function parseCodexOutput(stdout: string) {
  let result = '';
  let promptTokens = 0;
  let completionTokens = 0;

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) {
      continue;
    }

    let event: CodexEvent;
    try {
      event = JSON.parse(trimmed) as CodexEvent;
    } catch {
      continue;
    }

    if (isItemCompletedEvent(event) && event.item?.type === 'agent_message' && typeof event.item.text === 'string') {
      result = event.item.text;
    }

    if (isTurnCompletedEvent(event) && event.usage) {
      promptTokens = event.usage.input_tokens ?? 0;
      completionTokens = event.usage.output_tokens ?? 0;
    }
  }

  if (!result) {
    throw new Error('No result message received from Codex');
  }

  return {
    result,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    },
  };
}

async function runCodex(prompt: string, actualModel: string) {
  return await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(
      CODEX_BIN,
      [
        'exec',
        '--json',
        '--ephemeral',
        '--color',
        'never',
        '--sandbox',
        'read-only',
        '--skip-git-repo-check',
        '--cd',
        process.cwd(),
        '--model',
        actualModel,
        '-',
      ],
      {
        cwd: process.cwd(),
        env: process.env,
      }
    );

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, EXEC_TIMEOUT_MS);

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.stdin.write(prompt);
    child.stdin.end();

    child.on('error', error => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on('close', code => {
      clearTimeout(timeout);

      if (timedOut) {
        reject(new Error(`Codex exec timed out after ${EXEC_TIMEOUT_MS}ms`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`Codex exec failed with code ${code}: ${stderr || stdout}`));
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

export default async function handleCodex(args: Record<string, unknown>) {
  const { prompt, modelId, systemPrompt } = args;
  if (typeof prompt !== 'string' || typeof modelId !== 'string') {
    throw new Error('codex handler requires string "prompt" and "modelId" args');
  }

  const actualModel = MODEL_MAP[modelId];
  if (!actualModel) {
    throw new Error(`Unknown codex model ID: ${modelId}`);
  }

  const { stdout } = await runCodex(
    buildPrompt(prompt, typeof systemPrompt === 'string' ? systemPrompt : undefined),
    actualModel
  );

  return parseCodexOutput(stdout);
}
