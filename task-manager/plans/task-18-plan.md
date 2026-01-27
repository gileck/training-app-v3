# Task 18: Enable Local Testing in Implementor Agent with yarn dev - Implementation Plan

## Objective

Enable the implementor agent to start a local development server (`yarn dev`), use Playwright MCP tools to verify the implementation works correctly, and fix any issues before creating a PR. This catches problems earlier in the workflow, reducing wasted review cycles.

---

## ✅ VALIDATED: Proof of Concept Complete

**We successfully tested the full E2E workflow on 2026-01-27:**

| Step | Result |
|------|--------|
| Start `yarn dev` | ✅ Server started, port detected from output |
| Connect Playwright MCP | ✅ MCP server connected successfully |
| Navigate to `/todos` | ✅ Page loaded |
| Take DOM snapshot | ✅ Found 12 todos (11 done, 1 pending) |
| Click checkbox | ✅ Marked todo as complete |
| Verify state change | ✅ Progress: 11/12 → 12/12 (100%) |
| Close browser | ✅ Cleanup complete |

**Test Scripts Created:**
- `scripts/test-playwright-mcp.ts` - Basic MCP connectivity test
- `scripts/test-playwright-e2e.ts` - Full E2E workflow test

---

## Working Configuration (VALIDATED)

### 1. Install @playwright/mcp Package

**CRITICAL:** Must be installed locally. Using `npx` causes timeouts.

```bash
yarn add -D @playwright/mcp@latest
```

### 2. MCP Server Configuration

```typescript
const PLAYWRIGHT_MCP_CONFIG = {
    playwright: {
        command: 'node',
        args: ['./node_modules/@playwright/mcp/cli.js', '--headless'],
    },
};
```

### 3. SDK Query with MCP

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

for await (const message of query({
    prompt: testPrompt,
    options: {
        mcpServers: PLAYWRIGHT_MCP_CONFIG,
        allowedTools: ['mcp__playwright__*', 'Read', 'Glob', 'Grep'],
        cwd: process.cwd(),
        model: 'sonnet',
        maxTurns: 30,
        permissionMode: 'bypassPermissions',
    },
})) {
    // Handle messages...
}
```

### 4. Dev Server with Port Detection

```typescript
// Detect actual port from yarn dev output (may not be 3000 if busy)
devServer.stdout?.on('data', (data) => {
    const portMatch = data.toString().match(/localhost:(\d+)/);
    if (portMatch) {
        DEV_SERVER_PORT = parseInt(portMatch[1], 10);
    }
});
```

---

## Approach

The implementation will add a **local testing step** between the implementation phase and the PR creation phase in the implementor agent:

1. **Starting the dev server**: After `yarn checks` passes, start `yarn dev` in background
2. **Running verification tests**: Use Playwright MCP tools to interact with the app
3. **Handling test failures**: Report failures with detailed error messages
4. **Cleanup**: Stop the dev server before proceeding to PR creation

**Key Design Decisions:**

- **Local MCP package**: Must use locally installed `@playwright/mcp` (not npx)
- **Headless mode**: Use `--headless` flag for CI/automated environments
- **Port detection**: Parse dev server output to detect actual port (handles port conflicts)
- **Wildcard tools**: Use `mcp__playwright__*` to allow all Playwright tools
- **Two-phase execution**: Code implementation → Local testing → PR creation

---

## Sub-tasks

- [ ] **1. Install @playwright/mcp package** (add to package.json)
  - Run `yarn add -D @playwright/mcp@latest`
  - This is required - npx times out during MCP server startup

- [ ] **2. Add local testing configuration** (`src/agents/shared/config.ts`)
  - Add `localTesting.enabled` boolean (default: true)
  - Add `localTesting.devServerStartupTimeout` in seconds (default: 90)
  - Add `localTesting.testTimeout` in seconds (default: 120)

- [ ] **3. Create dev server management utility** (`src/agents/lib/devServer.ts`)
  - `startDevServer()`: Start `yarn dev` in background, detect port from output
  - `waitForDevServer(port, timeout)`: Poll until server responds
  - `stopDevServer(process)`: Kill the dev server process group
  - Handle proper cleanup on errors

- [ ] **4. Define Playwright MCP configuration** (`src/agents/lib/playwright-mcp.ts`)
  ```typescript
  export const PLAYWRIGHT_MCP_CONFIG = {
      playwright: {
          command: 'node',
          args: ['./node_modules/@playwright/mcp/cli.js', '--headless'],
      },
  };

  export const PLAYWRIGHT_TOOLS = ['mcp__playwright__*'];
  ```

- [ ] **5. Create local testing prompt builder** (`src/agents/core-agents/implementAgent/createLocalTestPrompt.ts`)
  - Generate a prompt that includes:
    - Product design requirements to verify
    - Technical design expected behavior
    - Instructions for using Playwright MCP tools
    - The detected dev server URL
    - Expected output format (test results)

- [ ] **6. Update implementAgent to add local testing step** (`src/agents/core-agents/implementAgent/index.ts`)
  - After `runYarnChecks()` succeeds and before PR creation:
    1. Check if local testing is enabled
    2. Start dev server and wait for it (with port detection)
    3. Run agent call with `mcpServers` and Playwright tools
    4. If tests pass, continue to PR creation
    5. If tests fail, report detailed error
    6. Stop dev server in finally block

- [ ] **7. Add --no-local-test flag to CLI**
  - Add option: `--no-local-test` to skip local testing
  - Useful when Playwright isn't available or for quick iterations

- [ ] **8. Document the local testing feature**
  - Update `docs/github-agents-workflow/workflow-guide.md`
  - Add troubleshooting section

- [ ] **9. Run yarn checks to verify implementation**

---

## Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Add `@playwright/mcp` as dev dependency |
| `src/agents/shared/config.ts` | Add `localTesting` configuration section |
| `src/agents/lib/devServer.ts` | **NEW** - Dev server start/stop/wait with port detection |
| `src/agents/lib/playwright-mcp.ts` | **NEW** - MCP config and tool definitions |
| `src/agents/core-agents/implementAgent/createLocalTestPrompt.ts` | **NEW** - Local test prompt builder |
| `src/agents/core-agents/implementAgent/index.ts` | Add local testing step after implementation |
| `src/agents/shared/index.ts` | Export new utilities |
| `src/agents/index.ts` | Add `--no-local-test` flag support |
| `docs/github-agents-workflow/workflow-guide.md` | Document local testing phase |

---

## Playwright MCP Tools Available

Based on testing, these tools are available via `mcp__playwright__*`:

| Tool | Purpose |
|------|---------|
| `browser_navigate` | Navigate to URLs |
| `browser_snapshot` | Capture page DOM/accessibility tree |
| `browser_click` | Click elements |
| `browser_type` | Type text into inputs |
| `browser_wait_for` | Wait for elements/conditions |
| `browser_close` | Close browser and cleanup |

---

## Notes

### Validated Findings

1. **✅ MCP Works with SDK**: Playwright MCP tools work with Claude Code SDK when configured via `mcpServers` option
2. **✅ Headless Works**: `--headless` flag runs browser without visible window
3. **✅ Local Install Required**: Must use locally installed package, not npx
4. **✅ Port Detection Needed**: Dev server may use different port if 3000 is busy
5. **✅ E2E Flow Works**: Full workflow (navigate → interact → verify) completed successfully in ~60s

### Implementation Recommendations

1. **Testing Scope**: Focus on happy-path verification only - verify the feature works as described
2. **No Fix Iterations**: If tests fail, report error and stop (don't auto-fix to avoid loops)
3. **Timeout Handling**: Use 90s for dev server startup, 120s for test execution
4. **Cleanup**: Always stop dev server in finally block, even on errors

### Reference Test Scripts

The following test scripts demonstrate the working implementation:

- **`scripts/test-playwright-mcp.ts`** - Tests basic MCP connectivity
- **`scripts/test-playwright-e2e.ts`** - Tests full E2E workflow with dev server

These can be used as reference for the implementation.

---

## Example Test Prompt

```typescript
const testPrompt = `
You are testing a web application. Use the Playwright MCP tools to verify the implementation.

## Test Steps

1. Navigate to ${DEV_SERVER_URL}${featureRoute}
2. Take a snapshot to see the current state
3. Verify the expected elements are present
4. Interact with the feature (click buttons, fill forms, etc.)
5. Verify the expected behavior occurred
6. Close the browser

## Expected Behavior
${expectedBehaviorFromDesign}

## Output Format
Report:
- **Test Result:** PASS or FAIL
- **Steps Performed:** List of actions taken
- **Observations:** What you saw on the page
- **Verification:** Before/after state comparison
`;
```

---

## Success Criteria

- [ ] Implementor agent can run `yarn dev` and detect the port
- [ ] Playwright MCP tools connect successfully (status: "connected")
- [ ] Agent can navigate, interact, and verify feature behavior
- [ ] Dev server is properly cleaned up after testing
- [ ] `--no-local-test` flag works to skip testing
- [ ] Documentation is updated
