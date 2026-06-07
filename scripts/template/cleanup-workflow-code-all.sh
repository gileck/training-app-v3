#!/usr/bin/env bash
#
# Cleanup leftover github-agents-workflow code across ALL child projects.
#
# The template removed the AI feature/bug pipeline. After a child runs
# `yarn sync-template`, the still-globbed template modules are deleted, but the
# DE-GLOBBED paths (src/agents/, src/pages/api/feature-requests/,
# src/pages/design-mocks/) plus project-local remnants (agent-tasks workflow
# configs, agent-logs/, package.json agent scripts, vitest.config) are orphaned.
# This script removes those orphans in every child.
#
# Discovery: every sibling directory of the template that has a `.template-sync.json`
# (the child marker) and is a git work tree.
#
# SAFETY:
#   - DRY RUN by default. Pass --apply to actually delete.
#   - Skips any child that has NOT yet synced the removal (workflow-service still
#     present) — deleting src/agents there would break workflow-service.
#   - Never commits. Review & commit per project afterwards.
#   - Touches ONLY workflow orphans. Leaves the in-app AI agent (agentic/,
#     src/server/project/*-agent), the RPC daemon (agent-tasks/rpc-daemon), and
#     general Telegram untouched.
#
# Usage:
#   bash scripts/template/cleanup-workflow-code-all.sh            # dry run
#   bash scripts/template/cleanup-workflow-code-all.sh --apply    # do it

set -uo pipefail

APPLY=0
ONLY=""
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=1 ;;
    --only=*) ONLY="${arg#--only=}" ;;
  esac
done

TEMPLATE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECTS_DIR="$(dirname "$TEMPLATE_ROOT")"
TEMPLATE_NAME="$(basename "$TEMPLATE_ROOT")"

# De-globbed source orphans (sync won't delete these) + project-local remnants.
# `task-manager/` is the analogous orphan from the earlier task-manager removal:
# it was never a synced path, so children keep it, and its tasks-cli.ts imported
# the now-relocated src/agents/shared/loadEnv → it breaks checks after this sync.
ORPHAN_DIRS=(
  "src/agents"
  "src/pages/api/feature-requests"
  "src/pages/design-mocks"
  "agent-tasks/all"
  "agent-tasks/triage"
  "agent-tasks/repo-commits-code-reviewer"
  "agent-logs"
  "task-manager"
)

if [ "$APPLY" = "1" ]; then
  echo "=== MODE: APPLY (deletions will be staged via git rm; nothing committed) ==="
else
  echo "=== MODE: DRY RUN (no changes) — pass --apply to execute ==="
fi
echo "Template:   $TEMPLATE_ROOT"
echo "Scanning:   $PROJECTS_DIR/*"
echo

processed=0; cleaned=0; skipped_unsynced=0; skipped_clean=0; skipped_nonchild=0

for child in "$PROJECTS_DIR"/*/; do
  child="${child%/}"
  name="$(basename "$child")"

  [ "$name" = "$TEMPLATE_NAME" ] && continue
  [ -n "$ONLY" ] && [ "$name" != "$ONLY" ] && continue     # --only=<name> filter
  [ -f "$child/.template-sync.json" ] || continue          # not a template child
  if ! git -C "$child" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "• $name — SKIP (not a git work tree)"; skipped_nonchild=$((skipped_nonchild+1)); continue
  fi

  # Gate: child must have already synced the workflow removal.
  if [ -d "$child/src/server/template/workflow-service" ]; then
    echo "• $name — SKIP (workflow removal not synced yet → run 'yarn sync-template' first)"
    skipped_unsynced=$((skipped_unsynced+1)); continue
  fi

  # Collect present orphans
  present=()
  for od in "${ORPHAN_DIRS[@]}"; do
    [ -e "$child/$od" ] && present+=("$od")
  done

  # Dead scripts = agent:/github-workflows-agent/agent-workflow keys, OR any script
  # whose command references a src//scripts/ file that no longer exists on disk.
  dead_scripts="$( cd "$child" && node -e '
    const fs=require("fs");
    let j; try{ j=JSON.parse(fs.readFileSync("package.json","utf8")); }catch(e){ process.exit(0); }
    const s=j.scripts||{}; const dead=[];
    for(const k of Object.keys(s)){
      const v=s[k];
      const agentKey=/^agent:/.test(k)||k==="github-workflows-agent"||k==="agent-workflow";
      let deadPath=false;
      const m=String(v).match(/(?:\.\/)?(?:src|scripts|task-manager)\/[^\s"'"'"']+\.(?:ts|tsx|js|sh)/);
      if(m && !fs.existsSync(m[0].replace(/^\.\//,""))) deadPath=true;
      if(agentKey||deadPath) dead.push(k);
    }
    process.stdout.write(dead.join("\n"));
  ' 2>/dev/null || true )"
  vitest_ref=""
  [ -f "$child/vitest.config.ts" ] && grep -q "src/agents" "$child/vitest.config.ts" 2>/dev/null && vitest_ref="vitest.config.ts → src/agents"

  if [ ${#present[@]} -eq 0 ] && [ -z "$dead_scripts" ] && [ -z "$vitest_ref" ]; then
    echo "• $name — already clean ✓"; skipped_clean=$((skipped_clean+1)); continue
  fi

  processed=$((processed+1))
  echo "• $name — orphans found:"
  for od in "${present[@]}"; do echo "    dir:    $od"; done
  if [ -n "$dead_scripts" ]; then
    echo "    package.json dead scripts ($(echo "$dead_scripts" | wc -l | tr -d ' ')): $(echo "$dead_scripts" | paste -sd, -)"
  fi
  [ -n "$vitest_ref" ] && echo "    $vitest_ref"

  if [ "$APPLY" = "1" ]; then
    ( cd "$child" || exit 1
      if [ ${#present[@]} -gt 0 ]; then
        git rm -r -q --ignore-unmatch "${present[@]}" 2>/dev/null || true
        rm -rf "${present[@]}"
      fi
      # Strip dead scripts from package.json (same rule as detection: agent keys, or
      # any script whose command references a src//scripts/ file that no longer exists).
      if [ -n "$dead_scripts" ]; then
        node -e '
          const fs=require("fs");const p="package.json";
          const j=JSON.parse(fs.readFileSync(p,"utf8"));
          const s=j.scripts||{};
          for(const k of Object.keys(s)){
            const v=s[k];
            const agentKey=/^agent:/.test(k)||k==="github-workflows-agent"||k==="agent-workflow";
            const m=String(v).match(/(?:\.\/)?(?:src|scripts|task-manager)\/[^\s"]+\.(?:ts|tsx|js|sh)/);
            const deadPath=m&&!fs.existsSync(m[0].replace(/^\.\//,""));
            if(agentKey||deadPath) delete s[k];
          }
          fs.writeFileSync(p,JSON.stringify(j,null,2)+"\n");
        ' || true
        git add package.json 2>/dev/null || true
      fi
      # Normalize vitest.config.ts off the deleted agent tests.
      if [ -n "$vitest_ref" ]; then
        cat > vitest.config.ts <<'VITEST'
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    testTimeout: 30_000,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    passWithNoTests: true,
  },
});
VITEST
        git add vitest.config.ts 2>/dev/null || true
      fi
    )
    echo "    → cleaned (review with: git -C \"$child\" status && yarn --cwd \"$child\" checks)"
    cleaned=$((cleaned+1))
  fi
  echo
done

echo "──────────────────────────────────────────────"
echo "children needing cleanup : $processed"
[ "$APPLY" = "1" ] && echo "children cleaned         : $cleaned"
echo "skipped (already clean)  : $skipped_clean"
echo "skipped (not synced yet) : $skipped_unsynced"
echo "skipped (non-git/other)  : $skipped_nonchild"
if [ "$APPLY" != "1" ] && [ "$processed" -gt 0 ]; then
  echo
  echo "Re-run with --apply to perform the deletions (then review & commit per project)."
fi
echo "NOTE: this does NOT fix unrelated in-app agentic errors (createAgentHandler/AgentHandlerConfig)."
