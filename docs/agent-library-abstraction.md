# Agent Library Abstraction

This document describes the agent library abstraction layer that enables swappable AI providers (Claude Code SDK, Cursor, Gemini, etc.) with per-workflow configuration.

---

## Overview

The agent library abstraction provides a unified interface for running AI agents regardless of the underlying provider. This allows:

- **Swappable AI providers** - Switch between Claude, Cursor, Gemini, etc. without changing workflow code
- **Per-workflow configuration** - Use different AI providers for different tasks (e.g., Claude for design, Cursor for implementation)
- **Future-proof architecture** - Easy to add new AI providers without refactoring existing code
- **Consistent API** - All workflows use the same `runAgent()` function

---

## Architecture

### Directory Structure

```
src/agents/
├── lib/                          # Agent library abstraction
│   ├── types.ts                  # AgentLibraryAdapter interface
│   ├── config.ts                 # Configuration loader (env vars)
│   ├── parsing.ts                # Library-agnostic output parsing
│   ├── index.ts                  # Factory: getAgentLibrary()
│   └── adapters/
│       ├── claude-code-sdk.ts    # Claude Code SDK implementation
│       ├── gemini.ts             # Google Gemini stub
│       └── cursor.ts             # Cursor AI stub
├── shared/                       # Workflow logic (unchanged)
│   ├── prompts.ts                # Library-agnostic
│   ├── notifications.ts          # Library-agnostic
│   └── index.ts                  # Re-exports from lib/
└── [workflow files]              # product-design.ts, tech-design.ts, etc.
```

### Key Components

#### 1. AgentLibraryAdapter Interface

Defines the contract that all AI provider adapters must implement:

```typescript
interface AgentLibraryAdapter {
    readonly name: string;
    readonly capabilities: AgentLibraryCapabilities;

    init(): Promise<void>;
    isInitialized(): boolean;
    run(options: AgentRunOptions): Promise<AgentRunResult>;
    dispose(): Promise<void>;
}
```

#### 2. Configuration System

Manages library selection via environment variables:

- `AGENT_DEFAULT_LIBRARY` - Default library for all workflows
- `AGENT_PRODUCT_DESIGN_LIBRARY` - Override for product design workflow
- `AGENT_TECH_DESIGN_LIBRARY` - Override for tech design workflow
- `AGENT_IMPLEMENTATION_LIBRARY` - Override for implementation workflow
- `AGENT_PR_REVIEW_LIBRARY` - Override for PR review workflow

#### 3. Parsing Layer

Library-agnostic functions for parsing agent output:

- `extractMarkdown()` - Extract markdown content with nested code block handling
- `extractJSON()` - Extract JSON from agent output
- `extractReview()` - Extract review content
- `parseReviewDecision()` - Parse review decision (approved/request_changes)
- Design document helpers (extractOriginalDescription, extractProductDesign, etc.)

#### 4. Factory Function

`getAgentLibrary(workflow?)` - Returns the appropriate adapter based on configuration:

```typescript
const library = await getAgentLibrary('product-design');
const result = await library.run({ prompt: '...', stream: true });
```

---

## Configuration

### Environment Variables

Add to `.env.local`:

```bash
# Default library (required)
AGENT_DEFAULT_LIBRARY=claude-code-sdk

# Per-workflow overrides (optional)
AGENT_PRODUCT_DESIGN_LIBRARY=gemini        # Use Gemini for product design
AGENT_TECH_DESIGN_LIBRARY=claude-code-sdk  # Use Claude for tech design
AGENT_IMPLEMENTATION_LIBRARY=cursor        # Use Cursor for implementation
AGENT_PR_REVIEW_LIBRARY=claude-code-sdk    # Use Claude for PR review
```

### Library Selection Logic

1. Check for workflow-specific override (e.g., `AGENT_PRODUCT_DESIGN_LIBRARY`)
2. Fall back to default library (`AGENT_DEFAULT_LIBRARY`)
3. Default to `claude-code-sdk` if no configuration

---

## Usage

### In Workflow Files

Workflows automatically use the configured library based on the `workflow` option:

```typescript
// In product-design.ts
const result = await runAgent({
    prompt: buildProductDesignPrompt(...),
    workflow: 'product-design',  // Auto-selects library from config
    stream: options.stream,
    verbose: options.verbose,
    timeout: options.timeout,
    progressLabel: 'Generating product design',
});
```

### Direct Library Access

For advanced use cases, you can get the library directly:

```typescript
import { getAgentLibrary } from '@/agents/lib';

const library = await getAgentLibrary('implementation');
console.log(`Using library: ${library.name}`);
console.log(`Capabilities:`, library.capabilities);

const result = await library.run({
    prompt: '...',
    allowWrite: true,
    stream: true,
});
```

---

## Available Adapters

### 1. Claude Code SDK (Default)

**Name:** `claude-code-sdk`

**Status:** ✅ Fully implemented

**Capabilities:**
- Streaming: ✅ Yes
- File Read: ✅ Yes
- File Write: ✅ Yes
- Web Fetch: ✅ Yes
- Custom Tools: ✅ Yes
- Timeout: ✅ Yes
- Slash Commands: ✅ Yes (e.g., `/pr-review`)

**Configuration:**
```bash
AGENT_DEFAULT_LIBRARY=claude-code-sdk
```

**Features:**
- Full integration with `@anthropic-ai/claude-agent-sdk`
- Progress indicators with spinner
- Timeout handling with abort controller
- Usage statistics (tokens, cost)
- Files examined tracking
- Slash command support (requires `useSlashCommands: true`)

### 2. Google Gemini

**Name:** `gemini`

**Status:** 🚧 Stub (not yet implemented)

**Planned Capabilities:**
- Streaming: ✅ Yes
- File Read: ❓ To be determined
- File Write: ❓ To be determined
- Web Fetch: ✅ Yes
- Custom Tools: ❓ To be determined
- Timeout: ✅ Yes

**Configuration:**
```bash
AGENT_PRODUCT_DESIGN_LIBRARY=gemini
```

**Implementation Notes:**
- Will use Google Gemini API
- Needs API key configuration
- Output parsing already compatible (uses same markdown/JSON extraction)

### 3. Cursor AI

**Name:** `cursor`

**Status:** 🚧 Stub (not yet implemented)

**Planned Capabilities:**
- Streaming: ✅ Yes
- File Read: ✅ Yes
- File Write: ✅ Yes
- Web Fetch: ❓ To be determined
- Custom Tools: ❓ To be determined
- Timeout: ✅ Yes

**Configuration:**
```bash
AGENT_IMPLEMENTATION_LIBRARY=cursor
```

**Implementation Notes:**
- Will integrate with Cursor's agent API
- Needs authentication setup
- Should leverage Cursor's file manipulation strengths

---

## Adding a New Adapter

To add support for a new AI provider:

### 1. Create Adapter File

Create `src/agents/lib/adapters/my-provider.ts`:

```typescript
import type { AgentLibraryAdapter, AgentLibraryCapabilities, AgentRunOptions, AgentRunResult } from '../types';

class MyProviderAdapter implements AgentLibraryAdapter {
    readonly name = 'my-provider';
    readonly capabilities: AgentLibraryCapabilities = {
        streaming: true,
        fileRead: true,
        fileWrite: true,
        webFetch: false,
        customTools: true,
        timeout: true,
    };

    private initialized = false;

    async init(): Promise<void> {
        // Initialize your provider (API keys, etc.)
        this.initialized = true;
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    async run(options: AgentRunOptions): Promise<AgentRunResult> {
        const { prompt, allowWrite, stream, timeout, progressLabel } = options;

        // Implement your provider's agent execution logic
        // Return AgentRunResult with success, content, error, etc.

        return {
            success: true,
            content: 'Generated content...',
            filesExamined: [],
            usage: null,
            durationSeconds: 10,
        };
    }

    async dispose(): Promise<void> {
        // Cleanup resources
        this.initialized = false;
    }
}

export default new MyProviderAdapter();
```

### 2. Configure Environment

Add to `.env.local`:

```bash
AGENT_DEFAULT_LIBRARY=my-provider
```

Or configure per-workflow:

```bash
AGENT_IMPLEMENTATION_LIBRARY=my-provider
```

### 3. Dynamic Loading

The factory will automatically load your adapter via dynamic import:

```typescript
// In lib/index.ts
const module = await import(`./adapters/${libraryName}`);
const adapter = module.default;
```

### 4. Test Integration

Run workflows with your new adapter:

```bash
# Set environment
export AGENT_DEFAULT_LIBRARY=my-provider

# Test with dry run
yarn agent:product-design --dry-run --limit 1

# Test with actual execution
yarn agent:product-design --limit 1
```

---

## Output Parsing

The parsing layer is library-agnostic and works on text output from any provider.

### Markdown Extraction

Handles nested code blocks properly:

```typescript
import { extractMarkdown } from '@/agents/lib';

const markdown = extractMarkdown(agentOutput);
// Returns markdown content from ```markdown ... ``` blocks
```

### JSON Extraction

Extracts JSON objects from agent output:

```typescript
import { extractJSON } from '@/agents/lib';

interface MyData { name: string; value: number }
const data = extractJSON<MyData>(agentOutput);
```

### Review Parsing

Extracts and parses PR review content:

```typescript
import { extractReview, parseReviewDecision } from '@/agents/lib';

const reviewContent = extractReview(agentOutput);
const decision = parseReviewDecision(reviewContent);
// Returns 'approved' or 'request_changes'
```

### Design Document Helpers

Work with GitHub issue bodies containing design sections:

```typescript
import {
    extractOriginalDescription,
    extractProductDesign,
    extractTechDesign,
    buildUpdatedIssueBody,
} from '@/agents/lib';

// Extract sections
const originalDesc = extractOriginalDescription(issueBody);
const productDesign = extractProductDesign(issueBody);
const techDesign = extractTechDesign(issueBody);

// Build updated body
const updatedBody = buildUpdatedIssueBody(
    originalDesc,
    newProductDesign,
    newTechDesign
);
```

---

## Migration Guide

### From Old Code (Direct claude.ts Import)

**Before:**
```typescript
import { runAgent } from './shared/claude';

const result = await runAgent({
    prompt: '...',
    stream: true,
});
```

**After:**
```typescript
import { runAgent } from './shared'; // or '@/agents/shared'

const result = await runAgent({
    prompt: '...',
    stream: true,
    workflow: 'product-design', // NEW: specify workflow
});
```

### Updating Workflow Files

All workflow files have been updated to include the `workflow` option:

- `product-design.ts` - `workflow: 'product-design'`
- `tech-design.ts` - `workflow: 'tech-design'`
- `implement.ts` - `workflow: 'implementation'`
- `pr-review.ts` - `workflow: 'pr-review'`

No changes required to prompt generation or output parsing logic.

---

## Benefits

### 1. Flexibility

Switch AI providers without changing workflow code:

```bash
# Try Gemini for product design
AGENT_PRODUCT_DESIGN_LIBRARY=gemini yarn agent:product-design

# Use Cursor for implementation
AGENT_IMPLEMENTATION_LIBRARY=cursor yarn agent:implement
```

### 2. Optimization

Use the best AI provider for each task:

- **Product Design** - Use a creative model (e.g., Claude Opus)
- **Tech Design** - Use a technical model (e.g., Claude Sonnet)
- **Implementation** - Use a code-focused model (e.g., Cursor)
- **PR Review** - Use a detail-oriented model (e.g., Claude)

### 3. Cost Optimization

Choose cost-effective models per workflow:

- Use cheaper models for simple tasks
- Use premium models only where needed
- Mix and match based on budget

### 4. Resilience

Fall back to alternative providers if one is unavailable:

```bash
# Primary fails? Switch to backup
AGENT_DEFAULT_LIBRARY=claude-code-sdk
AGENT_FALLBACK_LIBRARY=gemini
```

### 5. Future-Proof

Easy to adopt new AI providers as they emerge:

- New models from Anthropic, Google, OpenAI, etc.
- Open-source alternatives
- Custom fine-tuned models

---

## Troubleshooting

### Error: "Unknown agent library: xyz"

**Cause:** Library not found or not implemented

**Solution:** Check spelling and ensure library exists:
```bash
# Available libraries
ls src/agents/lib/adapters/
# claude-code-sdk.ts  cursor.ts  gemini.ts

# Use correct name
AGENT_DEFAULT_LIBRARY=claude-code-sdk
```

### Error: "Gemini adapter not yet implemented"

**Cause:** Trying to use a stub adapter

**Solution:** Use `claude-code-sdk` until the adapter is implemented:
```bash
AGENT_DEFAULT_LIBRARY=claude-code-sdk
```

### Library Not Switching

**Cause:** Configuration not loaded or cached

**Solution:** Restart your terminal or clear cache:
```bash
# Restart shell to reload env vars
exec $SHELL

# Or explicitly export
export AGENT_DEFAULT_LIBRARY=new-library
```

### Missing Environment Variables

**Cause:** `.env.local` not loaded

**Solution:** Ensure `.env.local` is in project root and properly formatted:
```bash
# .env.local
AGENT_DEFAULT_LIBRARY=claude-code-sdk

# Verify it's loaded
node -e "require('dotenv').config({ path: '.env.local' }); console.log(process.env.AGENT_DEFAULT_LIBRARY)"
```

---

## Performance

### Singleton Pattern

Adapters are instantiated once and reused:

```typescript
// First call - creates adapter
const lib1 = await getAgentLibrary('product-design');

// Second call - reuses same instance
const lib2 = await getAgentLibrary('product-design');

console.log(lib1 === lib2); // true
```

### Dynamic Loading

Adapters are loaded on-demand to minimize memory:

```typescript
// Only loads claude-code-sdk adapter
const library = await getAgentLibrary('product-design');
// gemini.ts and cursor.ts are NOT loaded
```

### Cleanup

Dispose all adapters when done:

```typescript
import { disposeAllAdapters } from '@/agents/lib';

// At end of script
await disposeAllAdapters();
```

---

## Related Files

### Core Files
- `src/agents/lib/types.ts` - Interface definitions
- `src/agents/lib/config.ts` - Configuration loader
- `src/agents/lib/parsing.ts` - Output parsing
- `src/agents/lib/index.ts` - Factory function
- `src/agents/lib/adapters/claude-code-sdk.ts` - Claude implementation

### Workflow Files
- `src/agents/product-design.ts` - Product design workflow
- `src/agents/tech-design.ts` - Technical design workflow
- `src/agents/implement.ts` - Implementation workflow
- `src/agents/pr-review.ts` - PR review workflow

### Documentation
- `CLAUDE.md` - Project guidelines (includes agent library section)
- `docs/github-projects-integration.md` - GitHub Projects workflow
- `docs/agent-library-abstraction.md` - This document

---

## Future Enhancements

### Planned Features

1. **Adapter Registry** - Register adapters programmatically
2. **Fallback Support** - Auto-retry with backup library on failure
3. **Performance Metrics** - Track success rates and latency per adapter
4. **Cost Tracking** - Aggregate costs across workflows
5. **A/B Testing** - Compare output quality across providers
6. **Streaming Improvements** - Unified streaming interface
7. **Tool Compatibility** - Adapter-specific tool mappings

### Contributing

To contribute a new adapter:

1. Implement `AgentLibraryAdapter` interface
2. Add tests for your adapter
3. Update this documentation
4. Submit a pull request

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

---

## Summary

The agent library abstraction provides:

- ✅ Unified interface for multiple AI providers
- ✅ Per-workflow configuration flexibility
- ✅ Library-agnostic output parsing
- ✅ Easy addition of new providers
- ✅ Backward-compatible with existing code

**Default Setup:** Works out of the box with Claude Code SDK

**Custom Setup:** Configure per-workflow libraries via environment variables

**Extensibility:** Add new adapters by implementing `AgentLibraryAdapter`
