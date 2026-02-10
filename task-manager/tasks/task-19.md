---
number: 19
title: Add OpenAI Codex to Agent Library as Optional Provider
priority: Medium
size: M
complexity: Medium
status: Done
dateAdded: 2026-01-27
dateUpdated: 2026-01-27
dateCompleted: 2026-01-27
commitHash: 7176182b4c28bb7c2f4dc73d2a1d01a545574590
---

# Task 19: Add OpenAI Codex to Agent Library as Optional Provider

**Summary:** Add OpenAI Codex as an optional agent library provider in the agent-lib abstraction layer, with configuration and testing.

## Files to Modify

- `src/agents/lib/adapters/openai-adapter.ts` - Create new OpenAI adapter (new file)
- `src/agents/lib/adapters/index.ts` - Export OpenAI adapter
- `src/agents/shared/config.ts` - Add OpenAI configuration options
- `src/agents/shared/types.ts` - Update types to support OpenAI models
- `scripts/test-agent-providers.ts` - Add OpenAI testing script (new file)
- `docs/agent-library-abstraction.md` - Document OpenAI integration

## Notes

- OpenAI Codex should be optional (enabled via env var: `OPENAI_API_KEY`)
- Follow the same adapter pattern as Claude Code SDK adapter
- Support model selection: `gpt-4`, `gpt-3.5-turbo`, etc.
- Include cost tracking similar to Claude adapter
- Add basic testing to verify the adapter works with OpenAI API

---
