/**
 * Adapter barrel. Each subfolder exposes an `init(config)` that
 * returns a configured `AgenticAdapter`. Aliased here so projects can
 * import everything from one place.
 */

export { init as initClaudeCode } from './claude-code';
export { init as initCodex, runCodexMcpServer } from './codex';
export type { CodexMcpServerConfig } from './codex';
