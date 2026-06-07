---
description: Create or update docs/project/project-overview.md — a living document describing the project's BUSINESS LOGIC (not architecture) - the high-level purpose, then route-by-route - what each route does, its UI/UX, the APIs it calls, and the data it reads/writes. Run once in each child project, and re-run after major feature changes to refresh it. The doc is wired into CLAUDE.md via yarn build:claude so every agent session starts with the business context loaded.
---

# Project Overview

Generate (or refresh) **`docs/project/project-overview.md`** — the single document that explains **what this app does**. It is the first thing a new agent or developer should read to understand the product, before diving into code.

## Business logic ONLY — not architecture

The template's architecture (offline-first, optimistic mutations, API pipeline, template/project split, state management rules) is already documented in `docs/template/` and CLAUDE.md. **Do not repeat any of it here.** This doc answers a different question: *what does this specific app do?*

✅ In scope: what each route lets the user do, the business rules, the business-logic APIs and what they do, what's saved in the DB (the actual fields and their meaning), the main features and where they're implemented.

❌ Out of scope: how React Query caching works, the optimistic-update pattern, how the API pipeline routes requests, folder-structure conventions, template features the project merely inherits (settings page, bug reports, etc.) unless the project customized their business behavior.

## Why `docs/project/`

- `docs/project/` is **project-owned** — never overwritten by template sync.
- `yarn build:claude` scans `docs/project/` for frontmattered docs and includes them in CLAUDE.md — so the overview becomes permanent context for every agent session in this project.

---

## Step 1 — Explore the project

Read the **project-owned** code. Minimum exploration:

| What | Where |
|---|---|
| Identity | `src/app.config.js` (appName, dbName), `package.json` (name, description), `public/manifest.json` |
| Routes | `src/client/routes/index.ts` (or `index.project.ts`) — every registered route + its options (`public`, `adminOnly`); `NavLinks.tsx` for which are user-facing |
| Route components | `src/client/routes/project/**` — what each page actually does, its main components and interactions |
| Features | `src/client/features/project/**` — cross-route feature modules |
| APIs | `src/apis/project/**` — each domain: `index.ts` (API names), `types.ts` (domain types), `handlers/` (the actual business rules — read them) |
| DB schemas | `src/server/database/collections/project/**` — each collection's document type: the fields and what they mean |
| Server logic | `src/server/project/**` — RPC handlers, services, jobs, if any |
| In-app agent | agent override seams / project agent config if the project customized the AI agent (system prompt, tools) |
| Integrations | usage of Telegram notifications, push, `AIModelAdapter`, external APIs — what business purpose each serves |

Also check `docs/project/` and `task-manager/` for any existing written context worth folding in.

**If the project is a fresh clone with no project code yet** (demo cleaned, nothing built): say so, and write a minimal overview stating the purpose (from app config / README) with an empty per-route scaffold — it will be filled in as the app grows.

---

## Step 2 — Write the doc

Write `docs/project/project-overview.md` (create `docs/project/` if missing). **The doc is structured per route** — each route is a self-contained section describing its UI/UX, APIs, and data. Cross-route concerns (shared features, background work) come after.

Write in product terms — what things do for the user and what the business rules are. Link to source files (`src/...`) so the reader can jump to the implementation; don't paste code.

```markdown
---
title: Project Overview
description: Business logic of <AppName> — what the app does, route by route - UI/UX, APIs, and data. Read this first to understand the product.
summary: <One paragraph: what the app is, who uses it, and its 3–5 core capabilities.>
priority: 1
---

# <AppName> — Project Overview

## Purpose

What problem the app solves, for whom, and the core value. 2–4 paragraphs max.
Mention who uses it (single owner? multi-user? admin vs users?) and any
business-level access rules (e.g. signups need admin approval).

## Routes

One subsection per registered route, in navigation order. User-facing routes first,
then admin routes. For each:

### `/route-path` — <Page Name>

**What it does:** 1–3 sentences — the user's goal on this page and the business
rules that apply (implemented in `src/client/routes/project/<Name>/`).

**UI / UX:** The main screens/components and interactions — lists, dialogs, forms,
swipe actions, empty states with business meaning. Short bullets.

**APIs:** The business-logic endpoints this route calls and what each does:
| Endpoint | What it does |
|---|---|
| `<domain>/getX` | ... (handler: `src/apis/project/<domain>/handlers/...`) |
| `<domain>/createX` | ... business rules enforced (validation, limits, side effects like notifications) |

**Data:** What is read/written and where it's stored:
| Collection | Fields that matter here | Notes |
|---|---|---|
| `<collection>` | `title`, `status`, `dueDate`, `userId` | per-user; status: 'open' \| 'done' |

(Skip any of the four blocks if genuinely empty — e.g. a static page has no APIs/Data.)

## Shared Features

Features used across multiple routes (`src/client/features/project/*`): for each,
what it does, which routes use it, and where it lives. Include the in-app AI agent
here if customized (its persona, what tools/data it can access).

## DB Schema Summary

One table listing ALL project collections in one place (the per-route sections show
slices; this is the complete picture):
| Collection | Document fields | Owned by |
|---|---|---|
| `<collection>` | full field list with types/meaning | per-user / global |

## Background Work & Integrations

Anything that runs without a user on a page: RPC handlers, scheduled jobs, agents,
Telegram/push notifications, AI calls, external APIs — what business purpose each
serves and what triggers it. Names of required env keys (never values).

## Notes

<!-- MANUAL SECTION — preserved across regenerations. Hand-written context,
decisions, and gotchas go here. -->
```

Guidance:

- **Accuracy over completeness** — only state what you verified in the code (read the handlers, not just the API names). No aspirational features.
- **Business rules are the payload** — "creating a todo over the free-tier limit returns an error", "deleting a project cascades to its tasks", "the owner gets a Telegram message on signup". These are what this doc exists to capture.
- Skip inherited template routes (`/login`, `/settings`, `/admin/approvals`, bug reports…) unless the project changed their business behavior — then document only the delta.
- Keep it readable in one sitting (~150–300 lines). It's an overview, not an audit.
- The frontmatter `summary` is what lands in CLAUDE.md — make it carry the essence of the app on its own.

---

## Step 3 — Update mode (doc already exists)

If `docs/project/project-overview.md` exists:

1. Read it first.
2. Re-explore (Step 1) and **rewrite sections that drifted** from the code — stale routes, removed features, changed APIs/schemas.
3. **Preserve the `## Notes` section verbatim** — it's hand-written.
4. Keep the frontmatter `summary` in sync with reality.

---

## Step 4 — Wire into CLAUDE.md

1. Run `yarn build:claude`.
2. Verify CLAUDE.md now contains the **Project Overview** section (it should appear near the top — `priority: 1`).
3. Show the user the frontmatter summary and the list of route sections so they can sanity-check the description of their own app.

Done. Re-run `/project-overview` after major feature work to keep the doc honest.
