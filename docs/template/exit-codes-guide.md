---
title: Exit Codes
description: How to properly check command success/failure. Use this when running shell commands.
summary: "**CRITICAL: Never parse command output to determine success/failure. Always use exit codes.** Exit code 0 = Success, non-zero = Failure. Use try/catch with execSync."
priority: 1
---

# Exit Codes: The ONLY Reliable Way to Check Success/Failure

> This is the detailed guide for exit code handling. For a quick reference, see [CLAUDE.md](../CLAUDE.md#exit-codes).

## Why Exit Codes?

**CRITICAL PRINCIPLE: NEVER parse command output to determine success/failure. ALWAYS use exit codes.**

Exit codes are the universal standard for determining command success:
- **Exit code 0** = Success
- **Exit code non-zero** = Failure

## The Problem with Output Parsing

❌ **WRONG - Output Parsing (UNRELIABLE):**
```typescript
const output = execSync('yarn checks:ci');
const success = output.includes('✅ All checks passed!'); // FRAGILE!
```

**Why this is bad:**
- Output format can change
- Output can be localized (different languages)
- Output can be truncated or buffered incorrectly
- Emoji rendering issues
- Timing issues with stdout/stderr interleaving

✅ **CORRECT - Exit Code (RELIABLE):**
```typescript
try {
    const output = execSync('yarn checks:ci', { stdio: 'pipe' });
    // If we get here, exit code was 0 = success
    return { success: true, output };
} catch (error) {
    // execSync throws when exit code is non-zero = failure
    return { success: false, output: error.stdout || error.message };
}
```

## When to Use Exit Codes

**ALWAYS use exit codes for:**
- ✅ CI/CD workflows
- ✅ Automated scripts
- ✅ Agent workflows
- ✅ Pre-commit hooks
- ✅ Build pipelines
- ✅ ANY automation

**Exceptions (Use Structured Output Instead):**
- When you need detailed status (not just pass/fail), use **structured JSON output**
- Example: `yarn sync-template --json` returns JSON with detailed status

## Example: Implement Agent

```typescript
// CORRECT implementation in src/agents/core-agents/implementAgent/index.ts
function runYarnChecks(): { success: boolean; output: string } {
    try {
        const output = execSync('yarn checks:ci', {
            encoding: 'utf-8',
            stdio: 'pipe',
            timeout: 120000,
        });
        // If execSync didn't throw, the command succeeded (exit code 0)
        return { success: true, output };
    } catch (error) {
        // execSync throws when command exits with non-zero code = failure
        const err = error as { stdout?: string; stderr?: string };
        const output = err.stdout || err.stderr || String(error);
        return { success: false, output };
    }
}
```

## Shell Script Exit Codes

In bash scripts (like `scripts/checks-ci.sh`):
```bash
# Run commands and capture exit codes
yarn ts
TS_EXIT=$?

yarn lint
LINT_EXIT=$?

# Check exit codes (not output!)
if [ $TS_EXIT -eq 0 ] && [ $LINT_EXIT -eq 0 ]; then
    exit 0  # Success
else
    exit 1  # Failure
fi
```

## Where This Is Enforced

This principle is documented and enforced in:
- `src/agents/core-agents/implementAgent/index.ts` - Uses exit codes
- `scripts/checks-ci.sh` - Returns proper exit codes
- `scripts/sync-child-projects.ts` - Requires JSON output, no output parsing

**Rule:** If you find code parsing output to check success/failure, replace it with exit code checking or structured output (JSON).

---

*Back to [CLAUDE.md](../CLAUDE.md)*
