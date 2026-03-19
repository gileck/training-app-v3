/**
 * Agent execution logging system
 *
 * This module provides comprehensive logging for AI agent executions,
 * creating human-readable Markdown logs for each issue.
 *
 * S3 Logging:
 * When AWS_S3_LOG_BUCKET is set, logs are written to S3 instead of the local
 * filesystem. This enables unified logging from all sources (local agents,
 * GitHub Actions, Vercel webhooks). When a workflow completes, the S3 log
 * is synced to the repository and the S3 file is deleted.
 *
 * ## Logging Policy
 *
 * All agents MUST use structured logging for the following categories:
 *
 * - **Errors**: Use `logError(ctx, error, isFatal)` instead of `console.error`.
 *   This ensures errors appear in the agent log with proper [LOG:ERROR]/[LOG:FATAL]
 *   markers that the workflow review agent can grep for.
 *
 * - **GitHub actions**: Use `logGitHubAction(ctx, action, details)` for any
 *   interaction with GitHub (comments posted, PRs created, status updates).
 *
 * - **Tool calls**: Use `logToolCall`/`logToolResult` for agent tool invocations.
 *
 * - **Token usage**: Use `logTokenUsage` for LLM cost tracking.
 *
 * - **Phase lifecycle**: Use `logExecutionStart`/`logExecutionEnd` to bracket
 *   each agent phase. Every agent must call these.
 *
 * - **Status transitions**: Use `logStatusTransition` when changing workflow status.
 *
 * - **Informational**: Use `logInfo` for notable events worth recording in the log.
 *
 * Console output (OK to keep as `console.log`):
 * - CLI progress messages ("Processing item...", "Starting agent...", etc.)
 * - Dry-run output ("[DRY RUN] Would...")
 * - Batch summaries and user-facing CLI output
 * - These are for the human operator running the CLI, not for the agent log file.
 */

export * from './types';
export * from './context';
export * from './writer';
export * from './logger';
export * from './cost-summary';

// S3 logging support
export * from './s3-writer';
export * from './s3-sync';
