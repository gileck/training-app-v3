# OpenAI Codex CLI Adapter

The OpenAI Codex CLI adapter provides integration with OpenAI's Codex CLI tool (`@openai/codex`) for AI-powered code analysis and generation.

## Prerequisites

**Subscription Required**: OpenAI Codex CLI requires either:
- ChatGPT Plus subscription
- ChatGPT Pro subscription
- OpenAI API key with sufficient credits

## Installation

### Option 1: npm (Recommended)

```bash
npm install -g @openai/codex
```

### Option 2: Homebrew (macOS)

```bash
brew install --cask codex
```

## Authentication

Login to authenticate:

```bash
codex login
```

This will open a browser window for authentication. Follow the prompts to complete setup.

### Check Login Status

```bash
codex login status
```

## Configuration

Configure the OpenAI Codex adapter in `src/agents/agents.config.ts`:

```typescript
export const agentsConfig: AgentsConfig = {
    defaultLibrary: 'openai-codex',  // Use Codex as default

    // Or use for specific workflows
    workflowOverrides: {
        'implementation': 'openai-codex',
    },

    libraryModels: {
        'openai-codex': {
            model: 'gpt-5-codex',  // or 'gpt-5'
        },
    },
};
```

## Available Models

| Model | Description |
|-------|-------------|
| `gpt-5-codex` | Codex-optimized model for code tasks |
| `gpt-5` | General-purpose GPT-5 model |

## Capabilities

| Capability | Support |
|------------|---------|
| Streaming | ✅ Yes |
| File Read | ✅ Yes |
| File Write | ✅ Yes (with sandbox controls) |
| Web Fetch | ❌ No |
| Custom Tools | ❌ Uses built-in tools |
| Timeout | ✅ Yes |

## Sandbox Modes

The adapter uses sandbox modes to control file access:

| Mode | Description | Used When |
|------|-------------|-----------|
| `read-only` | No file modifications | `allowWrite: false` |
| `workspace-write` | Can modify workspace files | `allowWrite: true` |

Note: The adapter does NOT use `danger-full-access` mode for safety reasons.

## CLI Command Structure

The adapter uses the `exec` subcommand for non-interactive execution:

### Basic execution
```bash
codex exec "<prompt>" --json --sandbox read-only
```

### With write access
```bash
codex exec "<prompt>" --json --sandbox workspace-write
```

### With model specification
```bash
codex exec "<prompt>" --json --model gpt-5-codex --ask-for-approval on-request
```

## Output Format

The CLI outputs newline-delimited JSON events:

```json
{"type":"init","session_id":"uuid"}
{"type":"message","role":"assistant","content":"thinking..."}
{"type":"tool_use","tool":"read_file","path":"..."}
{"type":"tool_result","status":"success"}
{"type":"result","usage":{"input_tokens":100,"output_tokens":50}}
```

## Testing

Run the adapter tests:

```bash
# All tests
yarn test-openai-codex-adapter

# Specific test
yarn test-openai-codex-adapter --test read

# With verbose output
yarn test-openai-codex-adapter --verbose

# Streaming mode tests
yarn test-openai-codex-adapter --stream

# Skip write tests
yarn test-openai-codex-adapter --skip-write
```

## Troubleshooting

### CLI Not Found

If you get "command not found":

```bash
# Verify installation
which codex

# Reinstall if needed
npm install -g @openai/codex
```

### Authentication Errors

If you get "not logged in" errors:

1. Check login status:
   ```bash
   codex login status
   ```

2. Re-authenticate:
   ```bash
   codex login
   ```

3. Verify subscription is active in your OpenAI account

### Timeout Issues

For long-running tasks, increase the timeout in your run options:

```typescript
await adapter.run({
    prompt: 'complex task...',
    timeout: 600,  // 10 minutes
});
```

### Sandbox Permission Errors

If file operations fail:

1. Ensure you're using `allowWrite: true` for write operations
2. Check that the file is within the workspace directory
3. Verify you have proper file permissions

## Known Limitations

1. **Subscription required**: ChatGPT Plus/Pro or API key needed
2. **No cost tracking**: CLI doesn't show cost per request
3. **Documentation gaps**: Some CLI flags not fully documented
4. **TUI-focused**: The CLI is primarily designed for interactive TUI mode; `exec` is secondary

## Cost Considerations

OpenAI Codex CLI usage is billed based on:
- Token consumption (input + output)
- Model tier (gpt-5-codex vs gpt-5)

Monitor your usage at: https://platform.openai.com/usage

## Resources

- [Codex CLI Documentation](https://developers.openai.com/codex/cli/)
- [Codex CLI Reference](https://developers.openai.com/codex/cli/reference/)
- [OpenAI Platform](https://platform.openai.com/)
- [ChatGPT Plus/Pro](https://chatgpt.com/)
