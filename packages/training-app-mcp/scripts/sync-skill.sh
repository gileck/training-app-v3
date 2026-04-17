#!/usr/bin/env bash
# Sync the canonical SKILL.md into a consumer project.
#
#   ./scripts/sync-skill.sh /path/to/consumer/skills-root
#
# `skills-root` should be the directory where the consumer keeps skill folders
# (e.g. nanoclaw's `container/skills`). A `use-training-app-v3/SKILL.md`
# subpath is created under it and overwritten from the canonical.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <consumer-skills-root>" >&2
  exit 2
fi

DEST_ROOT="$1"
if [[ ! -d "$DEST_ROOT" ]]; then
  echo "error: not a directory: $DEST_ROOT" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$SCRIPT_DIR/../skills/use-training-app-v3/SKILL.md"

if [[ ! -f "$SRC" ]]; then
  echo "error: canonical SKILL.md not found at $SRC" >&2
  exit 1
fi

DEST_DIR="$DEST_ROOT/use-training-app-v3"
mkdir -p "$DEST_DIR"
cp "$SRC" "$DEST_DIR/SKILL.md"
echo "synced → $DEST_DIR/SKILL.md"
