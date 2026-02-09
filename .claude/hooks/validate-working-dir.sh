#!/usr/bin/env bash
#
# PreToolUse hook: validates that file-modifying tool calls stay within
# the agent's working directory ($PWD). Prevents agents from accidentally
# writing to wrong directories when running with bypassPermissions.
#
# Receives JSON on stdin with tool_name and tool_input.
# Returns JSON with permissionDecision "allow" or "deny".

set -euo pipefail

# Read the full JSON input from stdin
INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
WORKING_DIR="$PWD"

# Ensure working dir ends without a trailing slash for consistent comparison
WORKING_DIR="${WORKING_DIR%/}"

# Helper: deny with a message
deny() {
  local msg="$1"
  echo "{\"hookSpecificOutput\":{\"permissionDecision\":\"deny\"},\"systemMessage\":\"$msg\"}"
  exit 0
}

# Helper: allow
allow() {
  echo "{\"hookSpecificOutput\":{\"permissionDecision\":\"allow\"}}"
  exit 0
}

# Helper: check if an absolute path is within the working directory
is_within_working_dir() {
  local path="$1"
  # Only validate absolute paths — relative paths resolve from cwd which is correct
  if [[ "$path" != /* ]]; then
    return 0
  fi
  # Normalize: remove trailing slashes
  path="${path%/}"
  # Check if path starts with working dir (exact match or subpath)
  if [[ "$path" == "$WORKING_DIR" || "$path" == "$WORKING_DIR/"* ]]; then
    return 0
  fi
  return 1
}

case "$TOOL_NAME" in
  Edit|Write)
    FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
    if [[ -z "$FILE_PATH" ]]; then
      # No file_path found — allow (tool may fail on its own)
      allow
    fi
    if is_within_working_dir "$FILE_PATH"; then
      allow
    else
      deny "BLOCKED: $TOOL_NAME attempted to modify '$FILE_PATH' which is outside the working directory '$WORKING_DIR'. All file operations must target paths within the working directory."
    fi
    ;;

  Bash)
    COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
    if [[ -z "$COMMAND" ]]; then
      allow
    fi

    # Extract absolute paths from rm, mv, cp commands and validate them.
    # We look for these destructive commands followed by absolute paths.
    # This is intentionally simple — we only catch the common cases of
    # absolute paths used with rm/mv/cp, not every possible shell construct.

    # Match absolute paths (starting with /) that appear after rm, mv, or cp commands.
    # We use grep to find lines with these commands, then extract absolute paths.
    HAS_DANGEROUS_CMD=false

    # Check if the command contains rm, mv, or cp with absolute paths
    # Use word-boundary matching to avoid false positives (e.g., "npm" matching "rm")
    for CMD_PREFIX in "rm " "rm$" "mv " "cp " "rmdir "; do
      if echo "$COMMAND" | grep -qE "(^|;|&&|\|\||[[:space:]])${CMD_PREFIX}"; then
        HAS_DANGEROUS_CMD=true
        break
      fi
    done

    if [[ "$HAS_DANGEROUS_CMD" == "false" ]]; then
      allow
    fi

    # Extract all absolute paths from the command
    # Match sequences starting with / that contain typical path characters
    ABSOLUTE_PATHS=$(echo "$COMMAND" | grep -oE '/[a-zA-Z0-9_./-]+' || true)

    if [[ -z "$ABSOLUTE_PATHS" ]]; then
      # Dangerous command but no absolute paths — likely using relative paths (ok)
      allow
    fi

    # Check each absolute path
    while IFS= read -r ABS_PATH; do
      [[ -z "$ABS_PATH" ]] && continue
      if ! is_within_working_dir "$ABS_PATH"; then
        deny "BLOCKED: Bash command contains '$ABS_PATH' which is outside the working directory '$WORKING_DIR'. Destructive operations (rm/mv/cp) must only target paths within the working directory."
      fi
    done <<< "$ABSOLUTE_PATHS"

    allow
    ;;

  *)
    # Unknown tool — allow by default
    allow
    ;;
esac
