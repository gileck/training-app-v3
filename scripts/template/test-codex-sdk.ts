#!/usr/bin/env tsx
/**
 * Minimal Codex SDK smoke test.
 *
 * This bypasses the app, RPC daemon, MongoDB, MCP tools, and React UI.
 * It only verifies that @openai/codex-sdk can start a Codex thread,
 * stream events, and receive a final agent_message for the selected
 * model.
 *
 * Usage:
 *   yarn test-codex-sdk
 *   yarn test-codex-sdk -- --model gpt-5.4 --timeout 120
 *   yarn test-codex-sdk -- --prompt "Reply with OK only."
 *   yarn test-codex-sdk -- --codex-path "$(command -v codex)"
 */

type Usage = {
    input_tokens?: number;
    output_tokens?: number;
    cached_input_tokens?: number;
    reasoning_output_tokens?: number;
};

type ThreadEvent =
    | { type: 'thread.started'; thread_id: string }
    | { type: 'turn.completed'; usage?: Usage }
    | { type: 'turn.failed'; error?: { message?: string } }
    | { type: 'error'; message?: string }
    | {
          type: 'item.started' | 'item.updated' | 'item.completed';
          item?: {
              type?: string;
              text?: string;
              message?: string;
              tool?: string;
              server?: string;
              query?: string;
          };
      };

interface Options {
    model: string;
    prompt: string;
    timeoutSec: number;
    effort: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
    verbose: boolean;
    codexPath?: string;
}

function parseArgs(argv: string[]): Options {
    const opts: Options = {
        model: 'gpt-5.5',
        prompt: 'Reply with exactly: OK',
        timeoutSec: 90,
        effort: 'low',
        verbose: false,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        const next = argv[i + 1];
        if (arg === '--model' && next) {
            opts.model = next;
            i += 1;
        } else if (arg === '--prompt' && next) {
            opts.prompt = next;
            i += 1;
        } else if (arg === '--timeout' && next) {
            opts.timeoutSec = Number(next);
            i += 1;
        } else if (arg === '--effort' && next) {
            if (!['minimal', 'low', 'medium', 'high', 'xhigh'].includes(next)) {
                throw new Error(`Invalid --effort: ${next}`);
            }
            opts.effort = next as Options['effort'];
            i += 1;
        } else if (arg === '--codex-path' && next) {
            opts.codexPath = next;
            i += 1;
        } else if (arg === '--verbose') {
            opts.verbose = true;
        } else if (arg === '--help' || arg === '-h') {
            printHelp();
            process.exit(0);
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }

    if (!Number.isFinite(opts.timeoutSec) || opts.timeoutSec <= 0) {
        throw new Error('--timeout must be a positive number of seconds');
    }

    return opts;
}

function printHelp() {
    console.log(`
Codex SDK smoke test

Options:
  --model <id>       Codex model id (default: gpt-5.5)
  --prompt <text>    Prompt to send (default: "Reply with exactly: OK")
  --timeout <sec>    Abort timeout in seconds (default: 90)
  --effort <level>   minimal | low | medium | high | xhigh (default: low)
  --codex-path <bin>  Override Codex CLI path (or use CODEX_PATH env)
  --verbose          Print every SDK event
`);
}

function formatUsage(usage: Usage | undefined): string {
    if (!usage) return 'usage unavailable';
    return [
        `input=${usage.input_tokens ?? 0}`,
        `cached=${usage.cached_input_tokens ?? 0}`,
        `output=${usage.output_tokens ?? 0}`,
        `reasoning=${usage.reasoning_output_tokens ?? 0}`,
    ].join(' ');
}

function describeEvent(event: ThreadEvent): string {
    if (event.type === 'thread.started') return `thread.started ${event.thread_id}`;
    if (event.type === 'turn.completed') {
        return `turn.completed ${formatUsage(event.usage)}`;
    }
    if (event.type === 'turn.failed') {
        return `turn.failed ${event.error?.message ?? 'unknown error'}`;
    }
    if (event.type === 'error') return `error ${event.message ?? 'unknown error'}`;

    const itemType = event.item?.type ?? 'unknown';
    if (itemType === 'agent_message') {
        return `${event.type} agent_message len=${event.item?.text?.length ?? 0}`;
    }
    if (itemType === 'mcp_tool_call') {
        return `${event.type} mcp_tool_call ${event.item?.server ?? '?'}.${event.item?.tool ?? '?'}`;
    }
    if (itemType === 'web_search') {
        return `${event.type} web_search ${event.item?.query ?? ''}`;
    }
    return `${event.type} ${itemType}`;
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    const startedAt = Date.now();

    const { Codex } = await import('@openai/codex-sdk');
    const codexPathOverride = opts.codexPath ?? process.env.CODEX_PATH;
    const codex = new Codex({
        codexPathOverride,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => {
        controller.abort(new Error(`Timed out after ${opts.timeoutSec}s`));
    }, opts.timeoutSec * 1000);

    let threadId = '';
    let finalText = '';
    let usage: Usage | undefined;

    console.log('Codex SDK smoke test');
    console.log(`model=${opts.model}`);
    console.log(`effort=${opts.effort}`);
    console.log(`timeout=${opts.timeoutSec}s`);
    console.log(`codexPath=${codexPathOverride ?? '(SDK default)'}`);
    console.log(`cwd=${process.cwd()}`);

    try {
        const thread = codex.startThread({
            model: opts.model,
            sandboxMode: 'read-only',
            workingDirectory: process.cwd(),
            skipGitRepoCheck: true,
            modelReasoningEffort: opts.effort,
            networkAccessEnabled: false,
            webSearchMode: 'disabled',
            approvalPolicy: 'never',
        });

        const { events } = await thread.runStreamed(opts.prompt, {
            signal: controller.signal,
        });

        for await (const event of events as AsyncIterable<ThreadEvent>) {
            if (opts.verbose) console.log(`[event] ${describeEvent(event)}`);

            if (event.type === 'thread.started') {
                threadId = event.thread_id;
            } else if (event.type === 'item.completed') {
                if (event.item?.type === 'agent_message') {
                    finalText = event.item.text ?? '';
                }
            } else if (event.type === 'turn.completed') {
                usage = event.usage;
            } else if (event.type === 'turn.failed') {
                throw new Error(event.error?.message ?? 'Codex turn failed');
            } else if (event.type === 'error') {
                throw new Error(event.message ?? 'Codex stream error');
            }
        }
    } finally {
        clearTimeout(timer);
    }

    const durationMs = Date.now() - startedAt;
    if (!finalText.trim()) {
        throw new Error('Codex completed without a final agent_message');
    }

    console.log('\nPASS');
    console.log(`thread=${threadId || '(not reported)'}`);
    console.log(`duration=${(durationMs / 1000).toFixed(1)}s`);
    console.log(formatUsage(usage));
    console.log(`response=${JSON.stringify(finalText.trim())}`);
}

main().catch((error) => {
    console.error('\nFAIL');
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'The operation was aborted') {
        console.error('Timed out waiting for Codex SDK to produce a final response.');
    } else {
        console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    }
    process.exitCode = 1;
});
