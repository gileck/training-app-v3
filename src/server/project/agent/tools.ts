/**
 * Training-coach tool set.
 *
 * The coach's domain capabilities (read plans / progress / exercises and
 * manage them) come from existing project APIs opted in via `apiMeta`
 * (see each `src/apis/project/<domain>/handlers/*.ts` + its `server.ts`).
 * Those are auto-collected by `buildAgentToolsFromApis` in the handler, so
 * they are NOT listed here.
 *
 * Here we only add the generic human-in-the-loop `ask_user` tool, which lets
 * the coach pause and ask the user to choose among concrete options (e.g.
 * "which plan should I update?") before acting.
 */

import {
    createAskUserTool,
    type AgenticTool,
} from '@/server/template/agentic';

/** No per-turn shared data context — each tool/API does its own
 *  userId-scoped reads. Keep this cheap; it runs once per turn. */
export type TrainingCoachDataContext = Record<string, never>;

/** Human-in-the-loop multiple-choice tool, bound to this agent's context. */
const askUser = createAskUserTool<TrainingCoachDataContext>();

export const TRAINING_COACH_TOOLS: ReadonlyArray<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous tool shapes
    AgenticTool<any, TrainingCoachDataContext>
> = [askUser];

export function createTrainingCoachDataContext(
    _userId: string
): TrainingCoachDataContext {
    return {};
}
