/**
 * Public surface of the generic agentic engine.
 *
 * Projects building a new agent should import everything they need
 * from this barrel rather than reaching into individual files.
 *
 * Pattern for a new agent (e.g. fitness-training):
 *
 *   1. `createToolBuilder<MyDataContext>()` → defines per-agent tools.
 *   2. `runCodexMcpServer({ agentName, tools, createDataContext })`
 *      in the Codex MCP server bootstrap (one tiny file the daemon
 *      spawns per Codex turn).
 *   3. `createAgentHandler({ adapters: [initClaudeCode(cfg), initCodex(cfg)], ... })`
 *      in the project's RPC handler — done.
 */

export * from './types';
export type {
    AgentConversationsCollection,
    FinalizeAssistantInput,
} from './conversations/types';
export { defineTool, createToolBuilder } from './defineTool';
export { createAskUserTool } from './tools/askUser';
export type { AskUserToolOptions } from './tools/askUser';
export { createAgentHandler } from './handler/createAgentHandler';
export type { AgentHandlerConfig } from './handler/createAgentHandler';
export { summarizeToolResult } from './eventSummary';
export {
    initClaudeCode,
    initCodex,
    runCodexMcpServer,
} from './adapters';
export type { CodexMcpServerConfig } from './adapters';
export { buildAgentToolsFromApis } from './apiTools';
export type { BuildAgentToolsOptions } from './apiTools';
export type { ApiMeta, ApiHandlersWithMeta } from '@/apis/types';
export { defineApiMeta } from '@/apis/types';
