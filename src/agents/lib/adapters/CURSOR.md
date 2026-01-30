# Cursor CLI Adapter

The Cursor CLI adapter provides integration with Cursor's `cursor-agent` CLI tool for AI-powered code analysis and generation.

## Installation

Install the Cursor CLI:

```bash
curl https://cursor.com/install -fsS | bash
```

## Authentication

Login to Cursor:

```bash
cursor-agent login
```

This requires an active Cursor subscription.

## Configuration

Configure the Cursor adapter in `src/agents/agents.config.ts`:

```typescript
export const agentsConfig: AgentsConfig = {
    defaultLibrary: 'cursor',  // Use Cursor as default

    // Or use for specific workflows
    workflowOverrides: {
        'implementation': 'cursor',
    },

    libraryModels: {
        'cursor': {
            model: 'claude-3-5-sonnet',  // or other supported models
        },
    },
};
```

## Features

### Structured Output Support

The Cursor adapter supports structured output through prompt injection. When you provide an `outputFormat` schema, it:

1. Injects the JSON schema into the prompt
2. Instructs the LLM to return valid JSON
3. Parses the JSON from the response
4. Returns it in `structuredOutput`

```typescript
const result = await cursorAdapter.run({
    prompt: 'Analyze this code...',
    outputFormat: {
        type: 'json_schema',
        schema: {
            type: 'object',
            properties: {
                summary: { type: 'string' },
                issues: { type: 'array', items: { type: 'string' } },
            },
            required: ['summary', 'issues'],
        },
    },
});

// Access structured output
if (result.structuredOutput) {
    const { summary, issues } = result.structuredOutput;
}
```

**Note:** Unlike Claude Code SDK's native structured output, Cursor's structured output is prompt-based ("soft" enforcement). The LLM follows the schema instructions but isn't strictly constrained by it. In rare cases, the output may not match the schema exactly.

### MCP Server Support

Cursor supports MCP (Model Context Protocol) servers for custom tools:

```typescript
await cursorAdapter.run({
    prompt: 'Navigate to the page...',
    mcpServers: {
        playwright: {
            command: 'node',
            args: ['./node_modules/@playwright/mcp/cli.js'],
        },
    },
});
```

MCP servers are configured in `.cursor/mcp.json` and enabled via `cursor-agent mcp enable`.

### Plan Mode

Use plan mode for read-only exploration:

```typescript
await cursorAdapter.run({
    prompt: 'Analyze the codebase structure',
    planMode: true,  // Read-only, no writes
});
```

## CLI Reference

Common CLI commands:

```bash
# Run agent with prompt
cursor-agent "your prompt" -p

# Run with JSON output
cursor-agent "prompt" -p --output-format json

# Run with streaming JSON
cursor-agent "prompt" -p --output-format stream-json

# Allow write operations
cursor-agent "prompt" -p --force

# Plan mode (read-only)
cursor-agent "prompt" -p --mode=plan

# MCP server management
cursor-agent mcp enable <identifier>
cursor-agent mcp disable <identifier>
```

## Testing

Run the structured output test to verify the adapter works:

```bash
npx tsx src/agents/tests/structured-output.test.ts --cursor
```

Or test all adapters:

```bash
npx tsx src/agents/tests/structured-output.test.ts --all
```

## Comparison with Claude Code SDK

| Feature | Claude Code SDK | Cursor |
|---------|----------------|--------|
| Structured Output | Native (enforced) | Prompt-based (soft) |
| Reliability | 100% schema match | ~95% schema match |
| MCP Support | Yes | Yes |
| Plan Mode | No | Yes |
| Web Fetch | Yes | No |
