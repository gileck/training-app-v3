# Agent Tests

Manual test scripts for the agent library adapters.

## Available Tests

### Cursor MCP Test

Tests the Cursor adapter's MCP (Model Context Protocol) integration with Playwright.

```bash
npx tsx src/agents/tests/cursor-mcp.test.ts
```

**Prerequisites:**
- `cursor-agent` CLI installed and authenticated
- `@playwright/mcp` package installed (`yarn add @playwright/mcp`)

**What it tests:**
- Cursor adapter initialization
- MCP server configuration (writes to `.cursor/mcp.json`)
- MCP server enabling (`cursor-agent mcp enable`)
- Running agent with Playwright MCP tools
- Browser navigation and page content retrieval

---

### Implementation E2E Test (Cursor)

Full end-to-end test that starts the dev server and uses cursor agent with Playwright MCP to interact with the app.

```bash
npx tsx src/agents/tests/implementation-e2e.test.ts
```

**Prerequisites:**
- `cursor-agent` CLI installed and authenticated
- `@playwright/mcp` package installed
- Port 3000 available for dev server

**What it tests:**
- Starts `yarn dev` server automatically
- Navigates to `/todos` page
- Interacts with todo items (toggle checkbox)
- Verifies UI state changes
- Cleans up server on completion

---

### Implementation E2E Test (Claude Code SDK)

Same E2E test using the Claude Code SDK adapter instead of Cursor.

```bash
npx tsx src/agents/tests/claude-code-sdk-e2e.test.ts
```

**Prerequisites:**
- `@playwright/mcp` package installed
- Port 3000 available for dev server
- Valid Anthropic API key (via environment or Claude Code auth)

**What it tests:**
- Same as Cursor E2E test but using `@anthropic-ai/claude-agent-sdk`
- Shows token usage and cost

**Expected output:**
```
📊 Test Result:
   Success: ✅
   Duration: ~30s

📝 Agent Report:
   - Page: /todos with todo items
   - Action: Clicked checkbox to toggle status
   - Result: PASS - todo status changed

💰 Usage: ~500 tokens, ~$0.09
```

---

## Adding New Tests

Create new test files following the naming convention: `<adapter>-<feature>.test.ts`

Example structure:
```typescript
#!/usr/bin/env npx tsx
import adapter from '../lib/adapters/<adapter>';

async function main() {
    // Test code here
}

main().catch(console.error);
```
