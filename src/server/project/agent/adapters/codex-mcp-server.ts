/**
 * Codex MCP server bootstrap for the training-coach.
 *
 * The Codex adapter spawns this script as a stdio subprocess once per turn.
 * It must expose the SAME tool list the daemon-side handler computes — kept
 * in sync via `buildAgentToolsFromApis(apiHandlers)`, which reads the same
 * registry at both call sites.
 */

import {
    runCodexMcpServer,
    buildAgentToolsFromApis,
} from '@/server/template/agentic';
import { apiHandlers } from '@/apis/apis';
import {
    TRAINING_COACH_TOOLS,
    createTrainingCoachDataContext,
} from '../tools';

const apiTools = buildAgentToolsFromApis({ handlers: apiHandlers });

runCodexMcpServer({
    agentName: 'training-coach',
    tools: [...TRAINING_COACH_TOOLS, ...apiTools],
    createDataContext: createTrainingCoachDataContext,
});
