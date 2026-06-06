/**
 * Agent client config override point (same pattern as `runtime.ts`).
 *
 * Ships a TEMPLATE DEFAULT and IS synced, so the template-owned agent store
 * can always import it (no missing-module break). It lives under
 * `client/utils` (element `client-utils`) rather than `features/project` so
 * the template store may import it without tripping the template→project
 * boundaries ESLint rule. A project customizes `defaultModelId` via
 * `build-app-agent` and adds this file to its `projectOverrides` so sync
 * keeps the change.
 */
export const agentClientConfig = {
    /** Default model id the agent model-picker starts on. */
    defaultModelId: 'claude-code-sonnet',
};
