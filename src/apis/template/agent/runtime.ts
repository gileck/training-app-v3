/**
 * Agent runtime override point (same pattern as `apis/auth-overrides.ts`).
 *
 * Ships TEMPLATE DEFAULTS that point `agent/sendMessage` at the demo agent.
 * It IS synced, so every project always has it (the template-owned handler
 * imports it — there must never be a missing-module break). A project
 * customizes the two values via `build-app-agent` and adds this file to its
 * `projectOverrides` (in `.template-sync.json`) so future syncs keep the
 * change. Until a real agent message is sent, the default is inert.
 */
export const agentRuntime = {
    /** RPC handler module the daemon runs for each turn. No file
     *  extension — the daemon resolves `.ts`/`.js`/`/index.*`. */
    handlerPath: 'src/server/project/demo-agent/handler',
    /** Default system prompt for the agent (overridable per-turn via the
     *  sendMessage request's `systemPrompt`). */
    systemPrompt:
        'You are a helpful assistant. You have these tools available: ' +
        'get_time (returns the current server time, optionally in a given timezone), ' +
        'calculate (one arithmetic operation on two numbers), and ' +
        'ask_user (ask the user one or more multiple-choice questions and wait for their answer — ' +
        'use it whenever the next step depends on a choice among concrete options; each question ' +
        'can be single-choice or multiSelect, and you may ask several at once). ' +
        'Use them when relevant. Be concise.',
};
