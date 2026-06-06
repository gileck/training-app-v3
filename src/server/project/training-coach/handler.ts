/**
 * Training-coach RPC handler.
 *
 * The daemon imports this module by path (see `agentRuntime.handlerPath`
 * in `src/apis/template/agent/runtime.ts`) and invokes its default export
 * for every coach turn. Wired with both Claude Code and Codex adapters —
 * `createAgentHandler` picks the first adapter that `supportsModel(modelId)`.
 */

import {
    createAgentHandler,
    initClaudeCode,
    initCodex,
    buildAgentToolsFromApis,
} from '@/server/template/agentic';
import { agentConversations } from '@/server/database';
import { apiHandlers } from '@/apis/apis';
import { TRAINING_COACH_TOOLS, createTrainingCoachDataContext } from './tools';

const AGENT_NAME = 'training-coach';

// Auto-generate tools from every API that opted in via `apiMeta`
// (training-plans, plan-exercises, weekly-progress, …). Each new opt-in
// lands automatically the next time this module reloads.
const apiTools = buildAgentToolsFromApis({ handlers: apiHandlers });

const handler = createAgentHandler({
    agentName: AGENT_NAME,
    tools: [...TRAINING_COACH_TOOLS, ...apiTools],
    createDataContext: createTrainingCoachDataContext,
    conversations: (userId) =>
        agentConversations.makeAgentConversationsAdapter(userId),
    adapters: [
        initClaudeCode({ agentName: AGENT_NAME }),
        initCodex({
            agentName: AGENT_NAME,
            // Explicit override: the default path derives a doubled suffix.
            // Point Codex at the real file.
            codexMcpServerPath:
                'src/server/project/training-coach/adapters/codex-mcp-server.ts',
            codexMcpInstruction:
                'Use the training_coach MCP tools (the api__* tools) to read and manage the user\'s training plans, exercises, and weekly progress. Do not inspect or edit repository files.',
        }),
    ],
});

export default handler;
