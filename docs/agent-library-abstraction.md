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
├── agents.config.ts              # Single source of truth for configuration
├── lib/                          # Agent library abstraction
│   ├── types.ts                  # AgentLibraryAdapter interface
│   ├── config.ts                 # Configuration loader
│   ├── parsing.ts                # Library-agnostic output parsing
│   ├── index.ts                  # Factory: getAgentLibrary()
│   └── adapters/
│       ├── claude-code-sdk.ts    # Claude Code SDK implementation
│       ├── gemini.ts             # Google Gemini CLI implementation
│       ├── cursor.ts             # Cursor CLI implementation
│       └── openai-codex.ts       # OpenAI Codex CLI implementation
├── shared/                       # Workflow logic (unchanged)
│   ├── prompts.ts                # Library-agnostic
│   ├── notifications.ts          # Library-agnostic
│   └── index.ts                  # Re-exports from lib/
└── core-agents/                  # Agent workflows
    ├── productDesignAgent/       # Product design workflow
    ├── technicalDesignAgent/     # Technical design workflow
    ├── implementAgent/           # Implementation workflow
    └── prReviewAgent/            # PR review workflow
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

All configuration is managed in `src/agents/agents.config.ts`:

```typescript
export const agentsConfig: AgentsConfig = {
    // Default library for all workflows
    defaultLibrary: 'claude-code-sdk',

    // Per-workflow overrides
    workflowOverrides: {
        // 'product-design': 'claude-code-sdk',
        // 'tech-design': 'claude-code-sdk',
        // 'implementation': 'cursor',
        // 'pr-review': 'claude-code-sdk',
    },
};
```

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

### Config File (`src/agents/agents.config.ts`)

This is the **single source of truth** for agent library selection:

```typescript
import type { WorkflowName } from './lib/types';

export interface AgentsConfig {
    /** Default library to use for all workflows */
    defaultLibrary: string;
    /** Per-workflow library overrides */
    workflowOverrides: Partial<Record<WorkflowName, string>>;
}

export const agentsConfig: AgentsConfig = {
    // Default library for all workflows
    defaultLibrary: 'claude-code-sdk',

    // Per-workflow overrides
    workflowOverrides: {
        // 'product-design': 'claude-code-sdk',
        // 'tech-design': 'claude-code-sdk',
        // 'implementation': 'cursor',
        // 'pr-review': 'claude-code-sdk',
    },
};
```

### Library Selection Logic

1. Check for workflow-specific override in `workflowOverrides`
2. Fall back to `defaultLibrary`

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
```typescript
export const agentsConfig: AgentsConfig = {
    defaultLibrary: 'claude-code-sdk',
};
```

**Features:**
- Full integration with `@anthropic-ai/claude-agent-sdk`
- Progress indicators with spinner
- Timeout handling with abort controller
- Usage statistics (tokens, cost)
- Files examined tracking
- Slash command support (requires `useSlashCommands: true`)
- **Plan Mode Support:** Uses read-only tools (`Read`, `Glob`, `Grep`, `WebFetch`) to explore codebase and generate implementation plans

### 2. Google Gemini CLI

**Name:** `gemini`

**Status:** ✅ Fully implemented

**Capabilities:**
- Streaming: ✅ Yes (via `--output-format stream-json`)
- File Read: ✅ Yes (ReadFile, FindFiles, SearchText, etc.)
- File Write: ✅ Yes (WriteFile, Shell with `--yolo`)
- Web Fetch: ❌ Not exposed via CLI
- Custom Tools: ❌ Uses built-in tools
- Timeout: ✅ Yes

**Configuration:**
```typescript
export const agentsConfig: AgentsConfig = {
    defaultLibrary: 'gemini',
    // Or per-workflow:
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

**Prerequisites:**
1. Install Gemini CLI:
   ```bash
   npm install -g @google/gemini-cli
   ```
2. Authenticate:
   ```bash
   export GEMINI_API_KEY=your_api_key
   # Or run `gemini` for interactive setup
   ```

**CLI Flags Used:**
| Option | CLI Flag |
|--------|----------|
| `prompt` | Command argument |
| `allowWrite` | `--yolo` |
| `!allowWrite` | `--allowed-tools ReadFile,FindFiles,...` |
| `stream` | `--output-format stream-json` |
| `!stream` | `--output-format json` |

**Documentation:** [docs/agent-library-gemini.md](./agent-library-gemini.md)

### 3. Cursor AI

**Name:** `cursor`

**Status:** ✅ Fully implemented

**Capabilities:**
- Streaming: ✅ Yes
- File Read: ✅ Yes
- File Write: ✅ Yes
- Web Fetch: ❌ No
- Custom Tools: ❌ No (uses Cursor's built-in tools)
- Timeout: ✅ Yes
- **Plan Mode: ✅ Yes** (via `--mode=plan`)

**Configuration:**
```typescript
export const agentsConfig: AgentsConfig = {
    defaultLibrary: 'cursor',
    // Or per-workflow:
    workflowOverrides: {
        'implementation': 'cursor',
    },
};
```

**Prerequisites:**
1. Install Cursor CLI:
   ```bash
   curl https://cursor.com/install -fsS | bash
   ```
2. Login to Cursor:
   ```bash
   cursor-agent login
   ```
3. Ensure you have an active Cursor subscription

**CLI Flags Used:**
| Option | CLI Flag |
|--------|----------|
| `prompt` | Command argument |
| `allowWrite` | `--force` |
| `stream` | `--stream-partial-output --output-format stream-json` |
| `!stream` | `--output-format json` |
| `planMode` | `--mode=plan` |
| `timeout` | Process timeout |

**Features:**
- Full integration with `cursor-agent` CLI
- JSON output parsing for structured results
- **Real-time streaming** with `--stream-partial-output` for live text output
- **Plan mode** with `--mode=plan` for read-only codebase exploration
- Progress indicators with spinner
- Timeout handling via process termination
- Files examined tracking from tool_use events
- Usage statistics extraction (when available)

### 4. OpenAI Codex CLI

**Name:** `openai-codex`

**Status:** ✅ Fully implemented

**Capabilities:**
- Streaming: ✅ Yes (via `--json` flag)
- File Read: ✅ Yes
- File Write: ✅ Yes (with sandbox controls)
- Web Fetch: ❌ No
- Custom Tools: ❌ Uses built-in tools
- Timeout: ✅ Yes

**Configuration:**
```typescript
export const agentsConfig: AgentsConfig = {
    defaultLibrary: 'openai-codex',
    // Or per-workflow:
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

**Prerequisites:**
1. Install Codex CLI:
   ```bash
   npm install -g @openai/codex
   # Or: brew install --cask codex
   ```
2. Login (requires ChatGPT Plus/Pro or API key):
   ```bash
   codex login
   ```

**CLI Flags Used:**
| Option | CLI Flag |
|--------|----------|
| `prompt` | `exec "<prompt>"` |
| `allowWrite` | `--sandbox workspace-write` |
| `!allowWrite` | `--sandbox read-only` |
| `stream` | `--json` |
| `model` | `--model gpt-5-codex` |
| `approval` | `--ask-for-approval on-request` |

**Features:**
- Full integration with `codex exec` command
- JSON output parsing for structured results
- Sandbox modes for file access control
- Streaming support with real-time event parsing
- Progress indicators with spinner
- Timeout handling via process termination
- Files examined tracking from tool_use events

**Documentation:** [docs/agent-library-openai-codex.md](./agent-library-openai-codex.md)

---

## Plan Mode and Plan Subagent

The agent library supports **Plan Mode** for detailed implementation planning before coding.

### Overview

Plan mode enables AI agents to explore the codebase and create detailed implementation plans without making changes. This is used automatically by the Implementation Agent workflow.

### How It Works

When `runAgent()` is called with `workflow: 'implementation'` and `allowWrite: true`, it automatically:

1. **Runs a Plan Subagent** - Explores the codebase in read-only mode
2. **Generates a detailed plan** - Step-by-step implementation instructions
3. **Augments the prompt** - Adds the plan to the main implementation prompt
4. **Runs implementation** - Main agent follows the detailed plan

This two-step process is **fully encapsulated** - calling code doesn't need to know about it.

### Library-Specific Implementation

| Library | Plan Mechanism | How It Works |
|---------|---------------|--------------|
| `claude-code-sdk` | Read-only tools | Runs with `allowedTools: ['Read', 'Glob', 'Grep', 'WebFetch']` |
| `cursor` | `--mode=plan` flag | Uses built-in plan mode for codebase exploration |
| `gemini`, `openai-codex` | Not supported | Uses high-level plan from tech design only |

### Plan Subagent Behavior

**For claude-code-sdk:**
```typescript
// Internally runs:
await library.run({
    prompt: planPrompt,
    allowedTools: ['Read', 'Glob', 'Grep', 'WebFetch'],
    allowWrite: false,
    timeout: 120, // 2 minutes
});
```

**For cursor:**
```typescript
// Internally runs with --mode=plan flag:
await library.run({
    prompt: planPrompt,
    planMode: true,
    allowWrite: false,
    timeout: 120,
});
```

### Using Plan Mode Directly

You can also use plan mode directly for custom planning tasks:

```typescript
import { runAgent } from '@/agents/lib';

// With cursor (uses --mode=plan)
const result = await runAgent({
    prompt: 'Create a plan for refactoring the auth module',
    workflow: 'implementation',
    planMode: true,
    allowWrite: false,
});

// With claude-code-sdk (uses read-only tools)
const result = await runAgent({
    prompt: 'Create a plan for refactoring the auth module',
    workflow: 'implementation',
    allowedTools: ['Read', 'Glob', 'Grep', 'WebFetch'],
    allowWrite: false,
});
```

### Plan Output Format

The Plan Subagent generates a numbered list of implementation steps:

```markdown
1. Create types file at `src/apis/feature/types.ts` with interfaces
2. Create handler at `src/apis/feature/handlers/get.ts`
3. Add API route at `src/pages/api/process/feature_get.ts`
4. Create React hook at `src/client/features/feature/useFeature.ts`
5. Export hook from `src/client/features/feature/index.ts`
6. Add component at `src/client/routes/Feature/index.tsx`
7. Run yarn checks to verify no errors
```

### Configuration

Plan mode is **automatically enabled** for implementation workflow. No configuration needed.

To disable (not recommended):
```typescript
// Plan subagent only runs when:
// - workflow === 'implementation'
// - library supports planMode OR is claude-code-sdk
// - allowWrite === true
```

### Timeout and Error Handling

- Plan subagent has a **2-minute timeout**
- If planning fails, implementation proceeds without the detailed plan
- Errors are logged but don't fail the overall workflow

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

### 2. Register Adapter

Import the adapter in `src/agents/lib/index.ts`:

```typescript
import myProviderAdapter from './adapters/my-provider';

const adapterInstances = new Map<string, AgentLibraryAdapter>([
    [claudeCodeSDKAdapter.name, claudeCodeSDKAdapter],
    [geminiAdapter.name, geminiAdapter],
    [cursorAdapter.name, cursorAdapter],
    [myProviderAdapter.name, myProviderAdapter], // Add here
]);
```

### 3. Configure

Update `src/agents/agents.config.ts`:

```typescript
export const agentsConfig: AgentsConfig = {
    defaultLibrary: 'my-provider',
    // Or per-workflow:
    workflowOverrides: {
        'implementation': 'my-provider',
    },
};
```

### 4. Test Integration

Run workflows with your new adapter:

```bash
# Test with dry run
yarn agent:product-design --dry-run --limit 1

# Test with actual execution
yarn agent:product-design --limit 1
```

### Testing the Cursor Adapter

```bash
# Use the test script
yarn test-cursor-adapter

# Run specific tests
yarn test-cursor-adapter --test read
yarn test-cursor-adapter --test stream

# Verbose output
yarn test-cursor-adapter --verbose
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

- `core-agents/productDesignAgent/index.ts` - `workflow: 'product-design'`
- `core-agents/technicalDesignAgent/index.ts` - `workflow: 'tech-design'`
- `core-agents/implementAgent/index.ts` - `workflow: 'implementation'`
- `core-agents/prReviewAgent/index.ts` - `workflow: 'pr-review'`

No changes required to prompt generation or output parsing logic.

---

## Benefits

### 1. Flexibility

Switch AI providers by modifying one config file:

```typescript
// src/agents/agents.config.ts
export const agentsConfig: AgentsConfig = {
    defaultLibrary: 'cursor', // Switch default
    workflowOverrides: {
        'product-design': 'claude-code-sdk', // Override for specific workflow
    },
};
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

### 4. Future-Proof

Easy to adopt new AI providers as they emerge:

- New models from Anthropic, Google, OpenAI, etc.
- Open-source alternatives
- Custom fine-tuned models

---

## Troubleshooting

### Error: "Unknown agent library: xyz"

**Cause:** Library not found or not registered

**Solution:** Check spelling and ensure library exists:
```bash
# Available libraries
ls src/agents/lib/adapters/
# claude-code-sdk.ts  cursor.ts  gemini.ts

# Use correct name in config
```

### Error: "Gemini adapter not yet implemented"

**Cause:** Trying to use a stub adapter

**Solution:** Use `claude-code-sdk` or `cursor` until the adapter is implemented.

### Error: "Cursor CLI not available"

**Cause:** Cursor CLI (`cursor-agent`) is not installed or not logged in

**Solution:**
1. Install Cursor CLI:
   ```bash
   curl https://cursor.com/install -fsS | bash
   ```
2. Login:
   ```bash
   cursor-agent login
   ```
3. Verify installation:
   ```bash
   cursor-agent --version
   ```

### Cursor Adapter Timeout

**Cause:** Long-running operations exceeding timeout

**Solution:** Increase timeout in options:
```typescript
await runAgent({
    prompt: '...',
    timeout: 600, // 10 minutes
    workflow: 'implementation',
});
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
- `src/agents/agents.config.ts` - Single source of truth for configuration
- `src/agents/lib/types.ts` - Interface definitions
- `src/agents/lib/config.ts` - Configuration loader
- `src/agents/lib/parsing.ts` - Output parsing
- `src/agents/lib/index.ts` - Factory function
- `src/agents/lib/adapters/claude-code-sdk.ts` - Claude implementation
- `src/agents/lib/adapters/cursor.ts` - Cursor CLI implementation
- `src/agents/lib/adapters/gemini.ts` - Gemini CLI implementation
- `src/agents/lib/adapters/openai-codex.ts` - OpenAI Codex CLI implementation

### Workflow Files
- `src/agents/core-agents/productDesignAgent/index.ts` - Product design workflow
- `src/agents/core-agents/technicalDesignAgent/index.ts` - Technical design workflow
- `src/agents/core-agents/implementAgent/index.ts` - Implementation workflow
- `src/agents/core-agents/prReviewAgent/index.ts` - PR review workflow

### Test Scripts
- `scripts/test-cursor-adapter.ts` - Test script for Cursor adapter
- `scripts/test-gemini-adapter.ts` - Test script for Gemini adapter
- `scripts/test-openai-codex-adapter.ts` - Test script for OpenAI Codex adapter

### Documentation
- `CLAUDE.md` - Project guidelines (includes agent library section)
- `docs/github-projects-integration.md` - GitHub Projects workflow
- `docs/agent-library-abstraction.md` - This document
- `docs/agent-library-gemini.md` - Gemini CLI adapter documentation
- `docs/agent-library-openai-codex.md` - OpenAI Codex CLI adapter documentation

---

## Future Enhancements

### Planned Features

1. **Fallback Support** - Auto-retry with backup library on failure
2. **Performance Metrics** - Track success rates and latency per adapter
3. **Cost Tracking** - Aggregate costs across workflows
4. **A/B Testing** - Compare output quality across providers
5. **Streaming Improvements** - Unified streaming interface
6. **Tool Compatibility** - Adapter-specific tool mappings

### Contributing

To contribute a new adapter:

1. Implement `AgentLibraryAdapter` interface
2. Register adapter in `src/agents/lib/index.ts`
3. Add tests for your adapter
4. Update this documentation
5. Submit a pull request

---

## Summary

The agent library abstraction provides:

- ✅ Unified interface for multiple AI providers
- ✅ Per-workflow configuration flexibility
- ✅ Library-agnostic output parsing
- ✅ Easy addition of new providers
- ✅ Backward-compatible with existing code
- ✅ Single config file for all settings (`src/agents/agents.config.ts`)

**Available Adapters:**
- `claude-code-sdk` - Claude Code SDK (default, fully implemented)
- `cursor` - Cursor CLI (fully implemented)
- `gemini` - Google Gemini CLI (fully implemented) - [Documentation](./agent-library-gemini.md)
- `openai-codex` - OpenAI Codex CLI (fully implemented) - [Documentation](./agent-library-openai-codex.md)

**Default Setup:** Works out of the box with Claude Code SDK

**Custom Setup:** Configure per-workflow libraries in `src/agents/agents.config.ts`

**Extensibility:** Add new adapters by implementing `AgentLibraryAdapter`
