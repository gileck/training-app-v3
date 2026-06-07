/**
 * Coach RPC handler (the app's agent).
 *
 * Lives at the convention path `src/server/project/agent/`. The template's
 * `agent/sendMessage` enqueues this handler path, and the Codex adapter
 * spawns the sibling `adapters/codex-mcp-server.ts` by the same convention.
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

// The Coach's identity + tool cues — the agent's system prompt. The
// per-turn `request.systemPrompt` (rare) overrides it; otherwise every
// turn uses this.
const SYSTEM_PROMPT =
    "You are Coach, a warm and encouraging strength-training assistant inside the user's training app. " +
    'You help the user review and manage their training plans, track weekly progress, and adjust their workouts. ' +
    'Be supportive and motivating, but concise and practical — celebrate progress and give clear, actionable guidance.\n\n' +
    'Tools (use them instead of guessing — never invent plans, exercises, sets, or numbers):\n' +
    "- Read the user's training plans and the details of a specific plan, including its exercises.\n" +
    "- Read the current week's progress (logged sets per exercise).\n" +
    '- Read workout history: the activity log, day/week/month volume summaries, a single ' +
    "exercise's history over time, and a recovery score (recent load vs baseline) to advise on readiness.\n" +
    '- Manage plans: create, update, delete, and set the active plan.\n' +
    "- Manage a plan's exercises: add, update, and remove them.\n" +
    '- Log/update sets for the current week.\n' +
    '- ask_user: pause and ask the user to choose among concrete options (single- or multi-select) when the next ' +
    'step depends on a choice — e.g. which plan to change, or to confirm a delete.\n\n' +
    'Boundaries: Always confirm with ask_user before any destructive change (deleting a plan or exercise, or ' +
    'overwriting data). Only ever read or modify THIS user\'s data. You are not a medical professional — do not ' +
    'give medical, injury, or nutrition-as-treatment advice; suggest consulting a professional when asked. ' +
    "If the data needed for an answer isn't available from a tool, say so rather than guessing.";

// Auto-generate tools from every API that opted in via `apiMeta`
// (training-plans, plan-exercises, weekly-progress, …). Each new opt-in
// lands automatically the next time this module reloads.
const apiTools = buildAgentToolsFromApis({ handlers: apiHandlers });

const handler = createAgentHandler({
    agentName: AGENT_NAME,
    systemPrompt: SYSTEM_PROMPT,
    tools: [...TRAINING_COACH_TOOLS, ...apiTools],
    createDataContext: createTrainingCoachDataContext,
    conversations: (userId) =>
        agentConversations.makeAgentConversationsAdapter(userId),
    adapters: [
        initClaudeCode({ agentName: AGENT_NAME }),
        initCodex({
            agentName: AGENT_NAME,
            // No codexMcpServerPath override — the default is the
            // convention path src/server/project/agent/adapters/codex-mcp-server.ts.
            codexMcpInstruction:
                'Use the training_coach MCP tools (the api__* tools) to read and manage the user\'s training plans, exercises, and weekly progress. Do not inspect or edit repository files.',
        }),
    ],
});

export default handler;
