/**
 * E2E Mock Registration
 *
 * Barrel export for all mocks.
 */

export { MockProjectAdapter } from './mock-project-adapter';
export { MockGitAdapter } from './mock-git-adapter';
export {
    mockRunAgent,
    agentCalls,
    resetAgentCalls,
    pushAgentResponse,
    resetAgentOverrides,
    CLARIFICATION_OUTPUT,
    PR_REVIEW_REQUEST_CHANGES_OUTPUT,
    MULTI_PHASE_TECH_DESIGN_OUTPUT,
} from './mock-run-agent';
export {
    capturedNotifications,
    resetNotifications,
} from './mock-notifications';
export * as mockNotifications from './mock-notifications';
export { resetDesignFiles } from './mock-design-files';
export * as mockDesignFiles from './mock-design-files';
