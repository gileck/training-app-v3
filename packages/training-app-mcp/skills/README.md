# Skill files

Canonical skill documents that describe how agents should use the training-app MCP server.

**`use-training-app-v3/SKILL.md`** is the source of truth. Copy it verbatim into any consumer.

## Consumers

- **This repo** — `.ai/skills/use-training-app-v3/SKILL.md` is a symlink to this canonical.
- **NanoClaw** — `container/skills/use-training-app-v3/SKILL.md` is a flat copy.
- **Any other project using `@training-app/mcp`** — copy to its agent's skills directory.

## Sync

```bash
# from training-app-v3 repo
cp packages/training-app-mcp/skills/use-training-app-v3/SKILL.md \
   /path/to/consumer/skills/use-training-app-v3/SKILL.md
```

Do this whenever `SKILL.md` changes here. See `packages/training-app-mcp/scripts/sync-skill.sh` for a helper.
