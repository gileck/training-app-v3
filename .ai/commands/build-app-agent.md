---
description: Build a domain-specific AI agent for this app (e.g. AI Doctor for a health app, Finance Manager for a budgeting app, Training Coach for a fitness app) on top of the template's agentic engine — define its identity, data context, tools, and UI, then wire and verify it end-to-end.
---

# Build the App's AI Agent

The template ships a **generic agentic chat stack** (engine + storage + chat UI + RPC transport + tracing). This skill turns that generic stack into **your app's own assistant** — an AI Doctor for a health app, a Finance Manager for a budgeting app, a Training Coach for a fitness app, and so on.

The agent's *identity*, *what data it sees*, and *what it can do* are the only things that differ per app. This skill walks you through defining exactly those, reusing everything else as-is.

> ## ⚠️ Prerequisite: RPC must be enabled first — run `/enable-rpc-calls`
>
> The agent **cannot answer at all** without it. Every turn is executed by a
> local **RPC daemon** that polls MongoDB for jobs (the Vercel function only
> enqueues the job — see the turn flow below). If RPC isn't set up, messages
> just sit pending forever. `/enable-rpc-calls` registers the daemon, mounts
> the connection indicator, and verifies it end-to-end.
>
> **Before starting this skill**, confirm RPC is enabled: `agent-tasks/rpc-daemon/config.json`
> exists and `yarn daemon` is running. If not, run `/enable-rpc-calls` first and
> come back. (Phase 0 re-checks this and will stop you if it's missing.)

**Run this conversationally.** Each phase has a verify gate. Do not advance until it passes. Prefer small, reviewable edits; run `yarn checks` after each phase that touches code.

---

## Mental model — how a turn flows

```
user types in /agent (client)
  → agent/sendMessage API (Vercel)  ── creates a pending assistant message + enqueues an RPC job
    → RPC daemon (local, long-lived) ── imports your handler.ts and runs it
      → adapter (Claude Code or Codex) runs the model with YOUR tools + system prompt
         · model calls tools  → your tool handlers run (DB reads/writes, scoped to userId)
         · events stream back  → appended to the message (thinking / tool_call / tool_result)
      → handler finalizes the assistant message (content, cost, tokens, events)
  → client polls agent/getConversation and renders the answer + timeline
```

You customize the **bold-italic** pieces below; the rest is template plumbing you reuse.

---

## What's template vs what you own

| Piece | Path | Owner | You edit? |
|---|---|---|---|
| Agentic **engine** (`createAgentHandler`, `createToolBuilder`, `buildAgentToolsFromApis`, `initClaudeCode`, `initCodex`, `runCodexMcpServer`, `defineApiMeta`) | `src/server/template/agentic/` | template (synced) | **Never** — import from `@/server/template/agentic` |
| Conversation **storage** (threads + messages) | `src/server/database/collections/template/agentConversations/` | template (synced) | Reuse as-is |
| **Traces** + verbose log + "Copy debug trace" | `src/server/database/collections/template/agentTraces/`, `/agent` ⋮ menu | template | Reuse for debugging |
| Chat **API domain** (`sendMessage`, `getConversation`, …) | `src/apis/template/agent/` | template (synced) | Don't edit — it enqueues the convention handler path for you |
| **RPC handler** (identity/system prompt, tools, data context) | `src/server/project/agent/handler.ts` | project (not synced) | **This is the heart — you build it.** `createAgentHandler({ systemPrompt, tools, … })` |
| **Tools** + data context | `src/server/project/agent/tools.ts` | project | You build it |
| Codex **MCP server** bootstrap | `src/server/project/agent/adapters/codex-mcp-server.ts` | project | You build it (mirror of the handler's tool list) |
| Default **model** seam | `src/client/utils/agentClientConfig.ts` | synced default, override + `projectOverride` | Edit `defaultModelId` **only if** you change it |
| Chat **composer** (`ChatComposer` — text input, file attach, paste, model picker, send/stop) | `src/client/components/template/chat/ChatComposer.tsx` | template (synced) | Reuse as-is — pass `models`/handlers as props |
| Chat **route + message list** (branding, welcome, timeline) | `src/client/routes/project/Agent/` | project | Edit branding/copy only |
| `/agent` route registration | `src/client/routes/index.project.ts` | project | Optional rename |
| Models the picker offers | `src/common/ai/models.ts` (`CLAUDE_CODE_MODELS`, `CODEX_MODELS`) | template | Reference only |
| RPC daemon registration | `agent-tasks/rpc-daemon/config.json` | project (not synced) | Already set by `/enable-rpc-calls` |

**Convention, not configuration.** Your app's agent lives at the fixed path **`src/server/project/agent/`** — that's where the template's `agent/sendMessage` enqueues the handler and where the Codex adapter looks for the MCP bootstrap. There is **no synced override seam** (no `runtime.ts`, no `projectOverrides` for the agent): the whole agent is project-owned under `src/server/project/agent/**`, and its identity is the `SYSTEM_PROMPT` you pass into `createAgentHandler`. The template ships an example agent there (a generic assistant: `get_time`, `calculate`, `ask_user`). You **customize it in place** — keep the folder name `agent`; the app-specific identity lives in the prompt, not the path.

---

## Phase 0 — Preflight

**Objective:** confirm the agent stack is present and runnable before changing anything.

1. **Child project check.** This skill is for child projects. If `package.json` `name` is `app-template-ai`, warn the user: running it here edits the *demo* agent (template documentation). Only proceed if they confirm that's intentional.
2. **Stack present?** Confirm these exist:
   - engine: `src/server/template/agentic/index.ts`
   - chat API: `src/apis/template/agent/handlers/sendMessage.ts`
   - chat UI: `src/client/routes/project/Agent/Agent.tsx`
   - the agent module at the convention path: `src/server/project/agent/handler.ts`

   If the engine is missing → tell the user to run `/sync-template`. If only the *demo agent* is missing (cleaned up) → note it; Phase 5 will scaffold a fresh module from the templates below.
3. **RPC daemon enabled?** The handler only runs if the local daemon is polling. Check `agent-tasks/rpc-daemon/config.json` exists and ask whether `yarn daemon` is running. If RPC isn't set up, stop and tell the user to run `/enable-rpc-calls` first — the agent cannot answer without it.
4. **Env:** `MONGO_URI` and `RPC_SECRET` must be in `.env.local` (shared by the API and the daemon). `appConfig.dbName` in `src/app.config.js` must be set.
   - **Local dev gate bypass.** By default `RPC_CONNECTION_ENABLED=true`, so `agent/sendMessage` requires an admin-approved RPC connection (Connect → Telegram approve) before any turn runs — locally that just errors with *"RPC connection required."* For a frictionless dev loop, ensure `.env.local` has `RPC_CONNECTION_ENABLED=false` (and `RPC_LOCAL_DIRECT=true` for parity); both are **local-only**, never pushed to Vercel. If they're missing, add them (this is `/enable-rpc-calls` Step 2c). Note: even with these, `yarn daemon` must be running — the agent enqueues via `createRpcJob`, which `RPC_LOCAL_DIRECT` does not bypass.
5. **Baseline green:** run `yarn checks`. If it's already red, fix or stop — don't build on a broken tree. Confirm the working tree is clean (this skill edits multiple files).

Gate: stack present, daemon path known, checks green. Then continue.

---

## Phase 1 — Define the agent's identity

**Objective:** decide who the agent is, then encode it in the system prompt.

Ask the user (use `AskUserQuestion` where a few clear options help, free text otherwise):
- **Name & role** — e.g. "Aria, an AI health companion", "Fin, a personal finance manager", "Coach, a strength-training assistant".
- **Scope & boundaries** — what it helps with, and crucially what it must NOT do (medical/financial/legal disclaimers, "not a substitute for a professional", never invent data, ask before destructive actions).
- **Tone** — concise/clinical, warm/encouraging, etc.
- **Default model** — `claude-code-sonnet` is a sensible default (Claude Code is the primary adapter and needs no extra setup). Other options: `claude-code-haiku` (cheap/fast), `claude-code-opus` (deep reasoning), or Codex `gpt-5.5` / `gpt-5.4` (require the Codex MCP subprocess from Phase 5).

Encode it in the system prompt. It lives as the `SYSTEM_PROMPT` constant in your project-owned handler `src/server/project/agent/handler.ts` (passed into `createAgentHandler({ systemPrompt: SYSTEM_PROMPT })`). It's plain project code — no seam, no `projectOverrides`. Replace the demo prompt with the app-specific identity, and **list the tools you'll add in Phase 3** so the model knows when to use them. Keep it tight — a few sentences of identity + a one-line cue per tool.

Also set the default model the picker opens on: `defaultModelId` in `src/client/utils/agentClientConfig.ts`. That one **is** a synced seam — only add it to `projectOverrides` **if you actually change it** from the template default (Phase 7).

Gate: `yarn checks` green. Continue.

---

## Phase 2 — Decide the data context

**Objective:** define what per-user app data the agent's tools share each turn.

`createDataContext(userId)` runs **once per turn** and returns an object handed to every tool as `ctx.data`. Use it to load the user's domain state the tools repeatedly need (health profile, account list, active training plan) so each tool doesn't re-fetch. Keep it cheap — it's on the hot path.

- If tools each do their own focused DB reads, the context can stay minimal (even `{}` like the demo).
- If several tools need the same data, load it here.

Decide with the user what (if anything) belongs in the context. You'll implement it in Phase 3 alongside the tools.

> Cross-tenant safety: tools receive `ctx.userId`. **Every** DB query a tool makes MUST filter by that `userId`. The agent runs as the user; never read or write another user's rows. (Same rule as auto-exposed API tools — admin endpoints are unreachable and `isAdmin` is always false.)

---

## Phase 3 — Build the tools

**Objective:** give the agent the actions it needs. Two complementary sources:

### 3a. Custom tools (`createToolBuilder`)

For domain actions you write by hand. Define them in `src/server/project/agent/tools.ts`:

```ts
import { z } from 'zod';
import { createToolBuilder, type AgenticTool } from '@/server/template/agentic';
// import the collections your handlers need, e.g.:
// import { symptomLogs } from '@/server/database';

/** Per-turn data shared by all tools. Loaded once by createDataContext. */
export interface DoctorDataContext {
    // e.g. profile: HealthProfile | null;
}

const tool = createToolBuilder<DoctorDataContext>();

const logSymptom = tool({
    name: 'log_symptom',
    // Descriptions are the model's only cue for WHEN to call this.
    // Be concrete: what it does, when to use it, what it returns.
    description:
        'Record a symptom the user reports (name + 1–10 severity). Use whenever the user mentions feeling unwell. Returns the saved entry id.',
    inputSchema: {
        name: z.string().min(1).describe('Symptom name, e.g. "headache".'),
        severity: z.number().int().min(1).max(10).describe('Severity 1–10.'),
    },
    handler: async (args, ctx) => {
        // ctx.userId (string), ctx.conversationId (ObjectId),
        // ctx.sourceMessageId (string), ctx.data (DoctorDataContext)
        // Do server work via @/server/database collections, filtered by userId.
        // Return a ToolResult envelope: { ok, data?, error?, truncated? }.
        return { ok: true, data: { saved: true } };
    },
    // Optional: mark writes so the UI shows a "saved" chip on the result.
    didMutate: () => true,
});

export const DOCTOR_AGENT_TOOLS: ReadonlyArray<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous tool shapes
    AgenticTool<any, DoctorDataContext>
> = [logSymptom];

export function createDoctorDataContext(_userId: string): DoctorDataContext {
    // Load per-user data the tools need (or return {}). Keep it cheap.
    return {};
}
```

Tool-writing rules:
- **Return the `ToolResult` envelope** (`{ ok: true, data }` or `{ ok: false, error }`) — never throw for expected failures; return `ok: false` with a message the model can recover from.
- **Summary keys** drive the timeline label automatically: `data.saved/updated/deleted/completed/registered`, or an array length, render a friendly chip (see `src/server/template/agentic/eventSummary.ts`).
- **Zod schema** is the contract — validation runs before your handler; invalid args come back to the model as a normal error it can retry.

### 3b. Auto-expose existing project APIs (`apiMeta`)

If the app already has API endpoints (e.g. `todos/getTodos`, `finance/listTransactions`), you usually don't rewrite them as tools — you **opt them in**. Two lines per endpoint:

1. Co-locate `export const apiMeta = defineApiMeta<Req>()({ description, inputSchema, agentExposed: true, mutates? })` next to the handler.
2. Reference it as the `meta` field on that endpoint's registry entry in the domain's `server.ts`.

`buildAgentToolsFromApis(apiHandlers)` (already called in the handler) turns every opted-in endpoint into a tool named `api__<domain>_<name>`. Default-deny: nothing is exposed without `agentExposed: true`; admin endpoints stay unreachable.

**Read `docs/template/agent-api-tools.md`** and follow its step-by-step before exposing APIs — it covers naming, the mutation flag, the session-resume gotcha, and the security model.

Pick the mix with the user (custom tools, exposed APIs, or both). Start with 2–4 high-value tools; you can add more anytime (they land on the next daemon reload).

Gate: `yarn checks` green. Continue.

---

## Phase 4 — Brand the chat UI

**Objective:** make `/agent` feel like the app's assistant, not a generic demo.

The composer itself (`ChatComposer`) is a shared, synced template component — don't fork it; it already gives every app the same text input, file attach, paste, model picker, and send/stop. Brand the **route around it** (copy only):
- **🏠 Always keep the Home button as the LEFTMOST item in the top bar** of `src/client/routes/project/Agent/Agent.tsx`. `/agent` is a `fullScreen` route, so the app's normal nav chrome is hidden — this Home icon (a ghost `Button` with `HomeIcon` → `onClick={() => navigate('/')}`) is the user's only way back out. The base `Agent.tsx` already ships it (top bar order: `[Home] [Threads] [Title] [RPC] [⋮ menu]`). **Never remove it**, and if you rename/restructure the header or build a fresh agent route, keep `[Home]` first — mirror the existing agent UI exactly.
- **Empty welcome** in `src/client/routes/project/Agent/Agent.tsx` (`EmptyWelcome`) — heading, blurb, and the tools hint chips.
- **Empty-thread hint** in `src/client/routes/project/Agent/MessageList.tsx` (the "How can I help?" block) — describe what this agent does.
- **Header title** fallback in `Agent.tsx` (`conversation?.title ?? 'AI Agent'`) → your agent's name.
- Optional: rename the route `/agent` → `/doctor` (or your domain) in `src/client/routes/index.project.ts`, and add it to `navItems`/`menuItems` in `src/client/components/NavLinks.tsx` if users should reach it from the nav (it's a `fullScreen` route, so otherwise it's only reachable by URL).
- Optional: seed suggested first-message prompts that showcase the tools.

Keep the mobile-first + semantic-token rules (no hardcoded colors; see the project UI guidelines).

Gate: `yarn checks` green. Continue.

---

## Phase 5 — Wire it up (rename + Codex + daemon)

**Objective:** connect your handler so the daemon runs it, and make the Codex adapter work.

**Customize in place — do NOT rename the folder.** The agent stays at `src/server/project/agent/`; that's the convention the template enqueues and the Codex adapter looks for. The agent's identity is the prompt, not the path. Wire the two files:

1. **`handler.ts`** — set `SYSTEM_PROMPT` (Phase 1), `AGENT_NAME` (a label for logs + the Codex MCP key), the tool list import, `createDataContext`, and the Codex instruction. **No `codexMcpServerPath` override** — the default is the convention path `src/server/project/agent/adapters/codex-mcp-server.ts`, exactly where this lives. **No handler-path config anywhere** — `sendMessage` enqueues `src/server/project/agent/handler` by convention.

```ts
import {
    createAgentHandler, initClaudeCode, initCodex, buildAgentToolsFromApis,
} from '@/server/template/agentic';
import { agentConversations } from '@/server/database';
import { apiHandlers } from '@/apis/apis';
import { DOCTOR_AGENT_TOOLS, createDoctorDataContext } from './tools';

const AGENT_NAME = 'doctor-agent'; // label only — folder stays `agent/`
const SYSTEM_PROMPT = '…the app-specific identity from Phase 1…';
const apiTools = buildAgentToolsFromApis({ handlers: apiHandlers });

const handler = createAgentHandler({
    agentName: AGENT_NAME,
    systemPrompt: SYSTEM_PROMPT,
    tools: [...DOCTOR_AGENT_TOOLS, ...apiTools],
    createDataContext: createDoctorDataContext,
    conversations: (userId) =>
        agentConversations.makeAgentConversationsAdapter(userId),
    adapters: [
        initClaudeCode({ agentName: AGENT_NAME }),
        initCodex({
            agentName: AGENT_NAME,
            codexMcpInstruction:
                'Use the doctor_agent MCP tools for the app actions. Do not inspect or edit repository files.',
        }),
    ],
});
export default handler;
```

2. **`adapters/codex-mcp-server.ts`** — the Codex adapter spawns this per turn; it must expose the **same tool list** as the handler:

```ts
import { runCodexMcpServer, buildAgentToolsFromApis } from '@/server/template/agentic';
import { apiHandlers } from '@/apis/apis';
import { DOCTOR_AGENT_TOOLS, createDoctorDataContext } from '../tools';

const apiTools = buildAgentToolsFromApis({ handlers: apiHandlers });
runCodexMcpServer({
    agentName: 'doctor-agent',
    tools: [...DOCTOR_AGENT_TOOLS, ...apiTools],
    createDataContext: createDoctorDataContext,
});
```

3. **Daemon working dir** — `agent-tasks/rpc-daemon/config.json` `script.workingDirectory` must point at this project's absolute path (set during `/enable-rpc-calls`; verify it's correct here, not the template path).

If the demo agent was already removed (`/cleanup-template-demo`), recreate `src/server/project/agent/{handler.ts,tools.ts,adapters/codex-mcp-server.ts}` from these templates plus the `tools.ts` from Phase 3.

> Codex note: Codex models run tools in a spawned MCP subprocess and enforce a per-tool timeout. If you only use Claude Code models, the Codex path is unused but harmless. If you use Codex, restart the daemon after wiring so it picks up the new subprocess path.

Gate: `yarn checks` green.

---

## Phase 6 — Verify end-to-end

**Objective:** prove a real turn works and the tools fire.

1. Restart the daemon so it reloads the handler (`yarn daemon`, or `yarn daemon:dev` for auto-reload). Confirm it's running and on the right database.
2. Open `/agent` (log in first), start a new thread, and send a message that should trigger a tool — e.g. for a doctor: "I've had a headache, severity 6, since this morning." Watch the assistant turn:
   - the **Working/Reasoning** timeline shows `tool_call <your_tool>` then `tool_result … (saved)`.
   - the answer reflects the tool result.
3. Confirm the side effect actually happened (the DB row was written, scoped to the user).
4. **Confirm the 🏠 Home button is present and leftmost** in the top bar and returns to `/` — it's the only way out of the fullScreen route.
5. If anything is off, open the ⋮ menu → **Copy debug trace** and read the end-to-end timeline (`send.received → rpc-job.claimed → handler.received → adapter.start → tool_call/tool_result → adapter.finished`). Common failures:
   - stuck at `rpc.enqueued` / `rpc-job.pending` → daemon not running or wrong DB.
   - `rpc-job.failed` with an import error → a bad import in your handler/tools (check the daemon console).
   - model never calls the tool → weak tool `description` or the system prompt doesn't mention it.
   - Codex tool errors → `codexMcpServerPath` wrong, or the subprocess can't import a collection.

Gate: a real turn calls a real tool and produces the right side effect.

---

## Phase 7 — Wrap up

- Run `yarn checks` one final time (must be green: TypeScript, ESLint, circular deps, unused deps).
- **`projectOverrides`?** The agent itself (`src/server/project/agent/**`) is project-owned and never synced — nothing to protect there. The one synced seam you *might* have touched is `src/client/utils/agentClientConfig.ts` (default model): add it to `projectOverrides` in `.template-sync.json` **only if** you changed `defaultModelId`. If you left it at the template default, leave it out (overriding an unchanged synced file just freezes it out of future updates).
- Summarize what was built: agent identity, the tools (custom + exposed APIs), data context, UI branding, and the handler wiring.
- Suggest follow-ups: more tools, richer data context, suggested-prompt presets, a domain disclaimer in the system prompt, and per-tool confirmation for destructive actions.
- Offer to commit (don't commit unprompted). Suggested message: `feat(agent): build <app> agent (<identity> + <tool summary>)`.

---

## Quick reference — files you touch per app

| Purpose | File |
|---|---|
| RPC handler + **system prompt** (identity) | `src/server/project/agent/handler.ts` |
| Tools + data context | `src/server/project/agent/tools.ts` |
| Codex MCP bootstrap | `src/server/project/agent/adapters/codex-mcp-server.ts` |
| Default model (synced seam — override only if changed) | `src/client/utils/agentClientConfig.ts` |
| UI branding (route only — composer is shared) | `src/client/routes/project/Agent/Agent.tsx`, `MessageList.tsx` |
| Route / nav (optional rename) | `src/client/routes/index.project.ts`, `src/client/components/NavLinks.tsx` |
| Expose existing APIs as tools | each handler's `apiMeta` + its `server.ts` (see `docs/template/agent-api-tools.md`) |

**Never edit** `src/server/template/agentic/**` — import from `@/server/template/agentic`.
