/**
 * Codex adapter — public surface.
 *
 * `init(config)` returns a configured `AgenticAdapter`. The Codex MCP
 * subprocess runtime (`runCodexMcpServer`) is also exported from here
 * since it's part of the Codex package — projects' codex-mcp-server.ts
 * bootstrap imports it to expose their tool list over stdio MCP.
 */

import type { AgenticAdapter, AgenticAdapterConfig } from '../../types';
import { CodexAgenticAdapter } from './adapter';

export function init(config: AgenticAdapterConfig): AgenticAdapter {
    return new CodexAgenticAdapter(config);
}

export { runCodexMcpServer } from './mcp-protocol';
export type { CodexMcpServerConfig } from './mcp-protocol';
