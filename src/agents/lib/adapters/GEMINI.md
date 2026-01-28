# Gemini CLI Adapter

The Gemini CLI adapter provides integration with Google's Gemini CLI tool (`@google/gemini-cli`) for AI-powered code analysis and generation.

## Installation

Install the Gemini CLI globally:

```bash
npm install -g @google/gemini-cli
```

Or using yarn:

```bash
yarn global add @google/gemini-cli
```

## Authentication

### Option 1: API Key (Recommended)

Set the `GEMINI_API_KEY` environment variable:

```bash
export GEMINI_API_KEY=your_api_key_here
```

Get your API key from: https://aistudio.google.com/apikey

### Option 2: Interactive Setup

Run the Gemini CLI without arguments for interactive authentication:

```bash
gemini
```

Follow the prompts to authenticate with your Google account.

## Configuration

Configure the Gemini adapter in `src/agents/agents.config.ts`:

```typescript
export const agentsConfig: AgentsConfig = {
    defaultLibrary: 'gemini',  // Use Gemini as default

    // Or use for specific workflows
    workflowOverrides: {
        'product-design': 'gemini',
    },

    libraryModels: {
        'gemini': {
            model: 'gemini-2.5-pro',  // or 'gemini-2.5-flash'
        },
    },
};
```

## Available Models

| Model | Description |
|-------|-------------|
| `gemini-2.5-pro` | Latest Gemini Pro model with 1M token context |
| `gemini-2.5-flash` | Faster, lighter model for quick tasks |

## Capabilities

| Capability | Support |
|------------|---------|
| Streaming | ✅ Yes |
| File Read | ✅ Yes (ReadFile, FindFiles, SearchText) |
| File Write | ✅ Yes (WriteFile, Shell) |
| Web Fetch | ❌ Not exposed via CLI |
| Custom Tools | ❌ Uses built-in tools |
| Timeout | ✅ Yes |

## CLI Command Structure

The adapter uses the following CLI commands internally:

### Non-streaming mode
```bash
gemini "<prompt>" --output-format json --yolo
```

### Streaming mode
```bash
gemini "<prompt>" --output-format stream-json --yolo
```

### Read-only mode (restricted tools)
```bash
gemini "<prompt>" --output-format json --allowed-tools ReadFile,FindFiles,SearchText,ReadManyFiles,GlobTool,GrepTool
```

## Output Format

### JSON Output
```json
{
  "response": "text response",
  "stats": {
    "models": {
      "gemini-2.5-flash": {
        "tokens": {
          "input": 8060,
          "output": 1,
          "total": 8077,
          "cached": 0
        }
      }
    },
    "tools": { "totalCalls": 5 }
  }
}
```

### Streaming Output (stream-json)
```json
{"type":"init","session_id":"uuid","model":"auto-gemini-2.5"}
{"type":"message","role":"assistant","content":"thinking...","delta":true}
{"type":"tool_use","tool_name":"read_file","parameters":{"path":"..."}}
{"type":"tool_result","tool_id":"id","status":"success","output":"..."}
{"type":"result","status":"success","stats":{"total_tokens":123}}
```

## Testing

Run the adapter tests:

```bash
# All tests
yarn test-gemini-adapter

# Specific test
yarn test-gemini-adapter --test read

# With verbose output
yarn test-gemini-adapter --verbose

# Streaming mode tests
yarn test-gemini-adapter --stream

# Skip write tests
yarn test-gemini-adapter --skip-write
```

## Rate Limits

Free tier limits:
- 60 requests per minute
- 1,000 requests per day

For higher limits, consider the paid tier.

## Troubleshooting

### CLI Not Found

If you get "command not found":

```bash
# Verify installation
which gemini

# Reinstall if needed
npm install -g @google/gemini-cli
```

### Authentication Errors

If you get authentication errors:

1. Verify your API key is set:
   ```bash
   echo $GEMINI_API_KEY
   ```

2. Test the CLI directly:
   ```bash
   gemini --version
   gemini "Hello, world!"
   ```

3. Re-authenticate if needed:
   ```bash
   gemini  # Interactive setup
   ```

### Timeout Issues

For long-running tasks, increase the timeout in your run options:

```typescript
await adapter.run({
    prompt: 'complex task...',
    timeout: 600,  // 10 minutes
});
```

## Known Limitations

1. **No cost tracking**: The CLI doesn't provide cost per request
2. **Free tier limits**: 60 req/min, 1,000 req/day
3. **No web search**: Web search is not exposed via CLI
4. **Approval is coarse**: `--yolo` is all-or-nothing for tool access

## Resources

- [Gemini CLI npm package](https://www.npmjs.com/package/@google/gemini-cli)
- [Gemini CLI GitHub](https://github.com/google-gemini/gemini-cli)
- [Gemini CLI Documentation](https://geminicli.com/docs/)
- [Get API Key](https://aistudio.google.com/apikey)
