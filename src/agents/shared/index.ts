/**
 * Shared utilities for GitHub Projects Integration Agents
 *
 * Re-exports all shared modules for convenient importing.
 */

// Load environment variables from .env.local and .env files
import './loadEnv';

// Configuration - re-exports from @/server/project-management plus agent-specific config
export {
    // Status constants
    STATUSES,
    REVIEW_STATUSES,
    REVIEW_STATUS_FIELD,
    // Project config helpers
    getProjectConfig,
    getRepoUrl,
    getProjectUrl,
    getIssueUrl,
    getPrUrl,
    // Agent-specific config
    agentConfig,
    // Types
    type Status,
    type ReviewStatus,
    type AgentConfig,
} from './config';

// Re-export domain types from project-management
export type {
    ProjectItem,
    ProjectItemContent,
    ProjectItemFieldValue,
    ProjectItemComment,
    PRReviewComment,
    ProjectField,
    ProjectFieldOption,
    ListItemsOptions,
    CreateIssueResult,
    CreatePRResult,
} from '@/server/project-management';

// Re-export the adapter getter
export { getProjectManagementAdapter } from '@/server/project-management';

// Agent-specific types
export type {
    UsageStats,
    AgentResult,
    CommonCLIOptions,
    DesignDocument,
    ParsedIssueBody,
    GitHubComment,
    ProcessingResult,
    BatchProcessingSummary,
} from './types';

// Agent library abstraction
export {
    runAgent,
    getAgentLibrary,
    extractMarkdown,
    extractJSON,
    extractReview,
    parseReviewDecision,
    extractOriginalDescription,
    extractProductDesign,
    extractTechDesign,
    buildUpdatedIssueBody,
    DESIGN_MARKERS,
    type AgentRunOptions,
    type AgentRunResult,
    type AgentLibraryAdapter,
    type WorkflowName,
} from '../lib';

// Notifications
export {
    notifyIssueSynced,
    notifyProductDesignReady,
    notifyTechDesignReady,
    notifyPRReady,
    notifyPRReviewComplete,
    notifyAgentNeedsClarification,
    notifyAgentError,
    notifyBatchComplete,
    notifyAutoAdvance,
    notifyAdmin,
    notifyAgentStarted,
} from './notifications';

// Prompts
export {
    buildProductDesignPrompt,
    buildProductDesignRevisionPrompt,
    buildProductDesignClarificationPrompt,
    buildTechDesignPrompt,
    buildTechDesignRevisionPrompt,
    buildTechDesignClarificationPrompt,
    buildImplementationPrompt,
    buildPRRevisionPrompt,
    buildImplementationClarificationPrompt,
    buildBugTechDesignPrompt,
    buildBugImplementationPrompt,
    buildBugTechDesignRevisionPrompt,
} from './prompts';

// Utilities
export {
    getIssueType,
    getBugDiagnostics,
    formatSessionLogs,
    extractClarification,
    handleClarificationRequest,
    extractFeedbackResolution,
    formatFeedbackResolution,
    type BugDiagnostics,
    type FeedbackResolution,
} from './utils';

// Agent Identity
export {
    addAgentPrefix,
    getAgentPrefix,
    hasAgentPrefix,
    extractAgentName,
    type AgentName,
} from './agent-identity';
