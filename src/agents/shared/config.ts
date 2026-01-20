/**
 * Agent-Specific Configuration
 *
 * Configuration specific to the agent scripts.
 * Status values and project config are imported from @/server/project-management.
 */

// Re-export from project management for convenience
export {
    STATUSES,
    REVIEW_STATUSES,
    REVIEW_STATUS_FIELD,
    getProjectConfig,
    getRepoUrl,
    getProjectUrl,
    getIssueUrl,
    getPrUrl,
    type Status,
    type ReviewStatus,
} from '@/server/project-management';

// ============================================================
// AGENT-SPECIFIC CONFIG
// ============================================================

export interface AgentConfig {
    telegram: {
        /** Whether to send Telegram notifications */
        enabled: boolean;
    };
    claude: {
        /** Claude model to use */
        model: 'sonnet' | 'opus' | 'haiku';
        /** Maximum number of agent turns */
        maxTurns: number;
        /** Timeout in seconds for agent execution */
        timeoutSeconds: number;
    };
}

/**
 * Agent configuration
 */
export const agentConfig: AgentConfig = {
    telegram: {
        enabled: true,
    },
    claude: {
        model: 'sonnet',
        maxTurns: 100,
        timeoutSeconds: 600,
    },
};
