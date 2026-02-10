/**
 * Output Schemas for Agent Structured Outputs
 *
 * Defines TypeScript interfaces and JSON schemas for structured outputs
 * from product-development, product-design, tech-design, and implement agents.
 */

// ============================================================
// SHARED CLARIFICATION TYPES
// ============================================================

/**
 * A single option in a clarification question.
 * Used in structured agent output for reliable parsing.
 */
export interface ClarificationOption {
    /** Short label for the option (e.g., "Phased approach") */
    label: string;
    /** Detailed description or explanation */
    description: string;
    /** Whether this is the recommended option */
    isRecommended: boolean;
}

/**
 * Structured clarification request from an agent.
 * This replaces the old markdown string format for reliable parsing.
 */
export interface StructuredClarification {
    /** Context describing what's ambiguous or unclear */
    context: string;
    /** The specific question being asked */
    question: string;
    /** Available options to choose from (2-4 options) */
    options: ClarificationOption[];
    /** Agent's recommendation text explaining why they recommend a specific option */
    recommendation: string;
}

/**
 * Clarification fields that are added to all agent output schemas.
 * When an agent needs clarification, it sets needsClarification=true
 * and provides structured clarification data.
 */
export interface ClarificationFields {
    /** Set to true if clarification is needed before proceeding */
    needsClarification?: boolean;
    /** Structured clarification data (required when needsClarification=true) */
    clarification?: StructuredClarification;
}

/**
 * JSON schema properties for clarification fields.
 * Merge this into each agent's output schema.
 */
export const CLARIFICATION_SCHEMA_PROPERTIES = {
    needsClarification: {
        type: 'boolean',
        description: 'Set to true if you need clarification before proceeding. When true, provide structured clarification data and leave other fields empty.',
    },
    clarification: {
        type: 'object',
        description: 'Structured clarification request. Required when needsClarification=true.',
        properties: {
            context: {
                type: 'string',
                description: 'Context describing what is ambiguous or unclear. Explain the situation and why clarification is needed.',
            },
            question: {
                type: 'string',
                description: 'The specific question being asked. Should be clear and actionable.',
            },
            options: {
                type: 'array',
                description: 'Available options to choose from. Provide 2-4 options with clear descriptions.',
                items: {
                    type: 'object',
                    properties: {
                        label: {
                            type: 'string',
                            description: 'Short label for the option (e.g., "Phased approach", "Build all upfront")',
                        },
                        description: {
                            type: 'string',
                            description: 'Detailed description explaining this option, its benefits, and tradeoffs. Use bullet points with newlines.',
                        },
                        isRecommended: {
                            type: 'boolean',
                            description: 'Set to true for the recommended option (only one option should be recommended)',
                        },
                    },
                    required: ['label', 'description', 'isRecommended'],
                },
            },
            recommendation: {
                type: 'string',
                description: 'Explain why you recommend the recommended option. Be specific about the reasoning.',
            },
        },
        required: ['context', 'question', 'options', 'recommendation'],
    },
};

// ============================================================
// PRODUCT DEVELOPMENT OUTPUT
// ============================================================

export interface ProductDevelopmentOutput extends ClarificationFields {
    document: string;
    comment: string;
}

export const PRODUCT_DEVELOPMENT_OUTPUT_FORMAT = {
    type: 'json_schema' as const,
    schema: {
        type: 'object',
        properties: {
            ...CLARIFICATION_SCHEMA_PROPERTIES,
            document: {
                type: 'string',
                description: 'Complete product development document in markdown format. ' +
                    'Should include: size estimate, problem statement, target users, ' +
                    'requirements with acceptance criteria, success metrics, scope (in/out). ' +
                    'Leave empty if needsClarification=true.',
            },
            comment: {
                type: 'string',
                description:
                    'High-level summary to post as GitHub comment. ' +
                    'For new documents: "Here\'s the product spec overview: 1. ... 2. ..." (3-5 items). ' +
                    'For revisions: "Here\'s what I changed: 1. ... 2. ..." (list specific changes made). ' +
                    'Leave empty if needsClarification=true.',
            },
        },
        required: ['document', 'comment'],
    },
};

// ============================================================
// PRODUCT DESIGN OUTPUT
// ============================================================

export interface ProductDesignOutput extends ClarificationFields {
    design: string;
    comment: string;
}

export const PRODUCT_DESIGN_OUTPUT_FORMAT = {
    type: 'json_schema' as const,
    schema: {
        type: 'object',
        properties: {
            ...CLARIFICATION_SCHEMA_PROPERTIES,
            design: {
                type: 'string',
                description: 'Complete product design document in markdown format. ' +
                    'Leave empty if needsClarification=true.',
            },
            comment: {
                type: 'string',
                description:
                    'High-level summary to post as GitHub comment. ' +
                    'For new designs: "Here\'s the design overview: 1. ... 2. ..." (3-5 items). ' +
                    'For revisions: "Here\'s what I changed: 1. ... 2. ..." (list specific changes made). ' +
                    'Leave empty if needsClarification=true.',
            },
        },
        required: ['design', 'comment'],
    },
};

// ============================================================
// TECH DESIGN OUTPUT
// ============================================================

/**
 * Implementation phase for multi-PR workflow (L/XL features)
 * Each phase should be independently mergeable and of S or M size
 */
export interface ImplementationPhase {
    /** Phase order number (1, 2, 3, etc.) */
    order: number;
    /** Short phase name (e.g., "Database Schema", "API Endpoints") */
    name: string;
    /** Description of what this phase implements */
    description: string;
    /** Files that will be modified in this phase */
    files: string[];
    /** Estimated size of this phase (should be S or M, not L/XL) */
    estimatedSize: 'S' | 'M';
}

export interface TechDesignOutput extends ClarificationFields {
    design: string;
    /** Implementation phases for L/XL features (optional - only for multi-PR workflow) */
    phases?: ImplementationPhase[];
    comment: string;
}

export const TECH_DESIGN_OUTPUT_FORMAT = {
    type: 'json_schema' as const,
    schema: {
        type: 'object',
        properties: {
            ...CLARIFICATION_SCHEMA_PROPERTIES,
            design: {
                type: 'string',
                description: 'Complete technical design document in markdown format. ' +
                    'Leave empty if needsClarification=true.',
            },
            phases: {
                type: 'array',
                description:
                    'Implementation phases for L/XL features only. Split large features into multiple ' +
                    'independently mergeable phases, each of size S or M. Each phase should be a complete, ' +
                    'testable unit of work. Leave empty/null for S/M features that can be done in a single PR. ' +
                    'Leave empty if needsClarification=true.',
                items: {
                    type: 'object',
                    properties: {
                        order: {
                            type: 'number',
                            description: 'Phase order number (1, 2, 3, etc.)',
                        },
                        name: {
                            type: 'string',
                            description: 'Short phase name (e.g., "Database Schema", "API Endpoints")',
                        },
                        description: {
                            type: 'string',
                            description: 'Description of what this phase implements',
                        },
                        files: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Files that will be modified in this phase',
                        },
                        estimatedSize: {
                            type: 'string',
                            enum: ['S', 'M'],
                            description: 'Estimated size of this phase (should be S or M)',
                        },
                    },
                    required: ['order', 'name', 'description', 'files', 'estimatedSize'],
                },
            },
            comment: {
                type: 'string',
                description:
                    'High-level implementation plan to post as GitHub comment. ' +
                    'For new designs: "Here\'s the implementation plan: 1. ... 2. ..." (3-5 items). ' +
                    'For revisions: "Here\'s what I changed: 1. ... 2. ..." (list specific changes made). ' +
                    'Leave empty if needsClarification=true.',
            },
        },
        required: ['design', 'comment'],
    },
};

// ============================================================
// IMPLEMENTATION OUTPUT
// ============================================================

/**
 * Visual verification status for UI changes
 */
export interface VisualVerification {
    /** Whether visual verification was performed */
    verified: boolean;
    /** What was visually verified (e.g., "Tested at 400px viewport, verified touch targets, checked dark mode") */
    whatWasVerified?: string;
    /** If verification was skipped, explain why (e.g., "Playwright MCP not available", "No UI changes in this PR") */
    skippedReason?: string;
    /** Any visual issues found and fixed during verification */
    issuesFound?: string;
}

export interface ImplementationOutput extends ClarificationFields {
    prSummary: string;
    comment: string;
    /** Visual verification status for UI changes (optional - only required when PR includes UI changes) */
    visualVerification?: VisualVerification;
}

export const IMPLEMENTATION_OUTPUT_FORMAT = {
    type: 'json_schema' as const,
    schema: {
        type: 'object',
        properties: {
            ...CLARIFICATION_SCHEMA_PROPERTIES,
            prSummary: {
                type: 'string',
                description: 'Complete PR description in markdown format. ' +
                    'Leave empty if needsClarification=true.',
            },
            comment: {
                type: 'string',
                description:
                    'High-level summary of what was done to post as GitHub comment. ' +
                    'For new implementations: "Here\'s what I did: 1. ... 2. ..." (3-5 items). ' +
                    'For revisions: "Here\'s what I changed: 1. ... 2. ..." (list specific changes made). ' +
                    'Leave empty if needsClarification=true.',
            },
            visualVerification: {
                type: 'object',
                description:
                    'Visual verification status for UI changes. Required when PR includes UI changes (.tsx files with visual components). ' +
                    'Omit this field if the PR has no UI changes or needsClarification=true.',
                properties: {
                    verified: {
                        type: 'boolean',
                        description: 'Whether visual verification was performed (true) or skipped (false)',
                    },
                    whatWasVerified: {
                        type: 'string',
                        description:
                            'What was visually verified. Example: "Tested at 400px viewport, verified touch targets are 44px, checked layout in dark mode"',
                    },
                    skippedReason: {
                        type: 'string',
                        description:
                            'If verification was skipped, explain why. Example: "Playwright MCP not available", "No visual components in changes"',
                    },
                    issuesFound: {
                        type: 'string',
                        description: 'Any visual issues found and fixed during verification. Example: "Fixed button overflow on small screens"',
                    },
                },
                required: ['verified'],
            },
        },
        required: ['prSummary', 'comment'],
    },
};

// ============================================================
// BUG INVESTIGATION OUTPUT
// ============================================================

/**
 * A fix option suggested by the bug investigator agent.
 * Represents a potential approach to fixing the bug.
 */
export interface FixOption {
    /** Unique identifier for the option (e.g., "opt1", "opt2") */
    id: string;
    /** Free-form title for the fix approach */
    title: string;
    /** Detailed description of what this fix involves */
    description: string;
    /** Where this fix should be routed after selection */
    destination: 'implement' | 'tech-design';
    /** Estimated complexity of implementing this fix */
    complexity: 'S' | 'M' | 'L' | 'XL';
    /** List of files that would be affected by this fix */
    filesAffected: string[];
    /** Trade-offs or considerations for this approach */
    tradeoffs?: string;
    /** Whether this is the recommended option */
    isRecommended: boolean;
}

/**
 * Output from the Bug Investigator agent.
 * Contains root cause analysis and suggested fix options.
 */
export interface BugInvestigationOutput extends ClarificationFields {
    /** Whether a root cause was identified */
    rootCauseFound: boolean;
    /** Confidence level in the root cause analysis */
    confidence: 'low' | 'medium' | 'high';
    /** Detailed analysis of the root cause */
    rootCauseAnalysis: string;
    /** Suggested fix options (1-N options, ideally 3 at different levels) */
    fixOptions: FixOption[];
    /** Files that were examined during investigation */
    filesExamined: string[];
    /** Additional logs or information that might help if root cause not found */
    additionalLogsNeeded?: string;
    /** Summary of the investigation for GitHub comment */
    summary: string;
    /** Auto-submit the recommended option without admin selection (for obvious, simple fixes) */
    autoSubmit?: boolean;
}

// ============================================================
// CODE REVIEW OUTPUT
// ============================================================

/**
 * A single finding from the code review agent.
 */
export interface CodeReviewFinding {
    /** Type of finding */
    type: 'bug' | 'improvement';
    /** Severity of the finding */
    severity: 'critical' | 'high' | 'medium' | 'low';
    /** Priority for issue creation (maps to agent-workflow --priority) */
    priority: 'critical' | 'high' | 'medium' | 'low';
    /** Estimated fix size */
    size: 'XS' | 'S' | 'M' | 'L';
    /** Estimated fix complexity */
    complexity: 'Low' | 'Medium' | 'High';
    /** Short actionable title (max 80 chars) */
    title: string;
    /** Detailed description: what, why, suggested fix */
    description: string;
    /** Affected files with line numbers (e.g., "path/to/file.ts:123") */
    affectedFiles: string[];
    /** Related commit hash */
    relatedCommit: string;
    /** Whether this finding warrants creating an issue */
    shouldCreateIssue: boolean;
    /** How likely this issue is to cause real problems */
    riskLevel: 'High' | 'Medium' | 'Low';
    /** Short explanation of when/how the risk manifests (e.g., "Crashes on every bot restart") */
    riskDescription: string;
    /** Client route affected by this bug (e.g., "/settings", "/home"). Only set if bug is in route-specific code. */
    route?: string;
}

/**
 * Output from the Repo Commits Code Reviewer agent.
 */
export interface CodeReviewOutput {
    /** List of findings from the code review */
    findings: CodeReviewFinding[];
    /** Summary statistics */
    summary: {
        commitsReviewed: number;
        bugsFound: number;
        improvementsFound: number;
    };
}

export const CODE_REVIEW_OUTPUT_FORMAT = {
    type: 'json_schema' as const,
    schema: {
        type: 'object',
        properties: {
            findings: {
                type: 'array',
                description: 'List of findings from the code review. Be conservative — better to miss a minor issue than create noise.',
                items: {
                    type: 'object',
                    properties: {
                        type: {
                            type: 'string',
                            enum: ['bug', 'improvement'],
                            description: 'Type of finding: "bug" for defects, "improvement" for enhancements',
                        },
                        severity: {
                            type: 'string',
                            enum: ['critical', 'high', 'medium', 'low'],
                            description: 'Severity: critical (breaks functionality), high (likely causes issues), medium (potential problem), low (minor concern)',
                        },
                        priority: {
                            type: 'string',
                            enum: ['critical', 'high', 'medium', 'low'],
                            description: 'Priority for issue creation, maps to agent-workflow --priority',
                        },
                        size: {
                            type: 'string',
                            enum: ['XS', 'S', 'M', 'L'],
                            description: 'Estimated fix size: XS (trivial, <10 lines), S (small, 10-50 lines), M (moderate changes), L (significant work)',
                        },
                        complexity: {
                            type: 'string',
                            enum: ['Low', 'Medium', 'High'],
                            description: 'Estimated fix complexity',
                        },
                        title: {
                            type: 'string',
                            description: 'Short actionable title (max 80 chars). Example: "Missing null check in user auth middleware"',
                        },
                        description: {
                            type: 'string',
                            description: 'Detailed description: what the issue is, why it matters, and suggested fix approach',
                        },
                        affectedFiles: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Affected files with line numbers (e.g., "src/server/auth.ts:45")',
                        },
                        relatedCommit: {
                            type: 'string',
                            description: 'The commit hash that pointed to the area of code where this finding was discovered',
                        },
                        shouldCreateIssue: {
                            type: 'boolean',
                            description: 'Whether this finding warrants creating an issue. Set to false for low-severity informational findings.',
                        },
                        riskLevel: {
                            type: 'string',
                            enum: ['High', 'Medium', 'Low'],
                            description: 'How likely this is to cause real problems. High: affects every user or crashes in production. Medium: affects some users or specific conditions. Low: theoretical edge case, unlikely in practice.',
                        },
                        riskDescription: {
                            type: 'string',
                            description: 'One sentence explaining when/how the risk manifests. E.g., "Crashes on every bot restart", "Only triggers if JSON file is manually corrupted", "Theoretical overflow after years of continuous use".',
                        },
                        route: {
                            type: 'string',
                            description: 'Client route affected by this bug (e.g., "/settings", "/home"). Only set if the bug is in route-specific code under src/client/routes/. Leave empty/omit for server-only, shared, or non-route code.',
                        },
                    },
                    required: ['type', 'severity', 'priority', 'size', 'complexity', 'title', 'description', 'affectedFiles', 'relatedCommit', 'shouldCreateIssue', 'riskLevel', 'riskDescription'],
                },
            },
            summary: {
                type: 'object',
                description: 'Summary statistics of the code review',
                properties: {
                    commitsReviewed: {
                        type: 'number',
                        description: 'Number of commits reviewed',
                    },
                    bugsFound: {
                        type: 'number',
                        description: 'Number of bugs found',
                    },
                    improvementsFound: {
                        type: 'number',
                        description: 'Number of improvements found',
                    },
                },
                required: ['commitsReviewed', 'bugsFound', 'improvementsFound'],
            },
        },
        required: ['findings', 'summary'],
    },
};

export const BUG_INVESTIGATION_OUTPUT_FORMAT = {
    type: 'json_schema' as const,
    schema: {
        type: 'object',
        properties: {
            ...CLARIFICATION_SCHEMA_PROPERTIES,
            rootCauseFound: {
                type: 'boolean',
                description: 'Whether a root cause was identified for the bug. Set to false if investigation is inconclusive.',
            },
            confidence: {
                type: 'string',
                enum: ['low', 'medium', 'high'],
                description: 'Confidence level in the root cause analysis: low (uncertain), medium (likely), high (confirmed).',
            },
            rootCauseAnalysis: {
                type: 'string',
                description:
                    'Detailed analysis of the root cause. Include: what specific code/logic fails, ' +
                    'what triggers the failure, why the current code behaves incorrectly. ' +
                    'If root cause not found, explain what was investigated and what remains unclear.',
            },
            fixOptions: {
                type: 'array',
                description:
                    'Suggested fix options. Ideally provide 3 options at different levels (quick fix, standard fix, refactor), ' +
                    'but only include options that genuinely make sense for this bug. Each option describes an approach to fixing the issue.',
                items: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            description: 'Unique identifier for this option (e.g., "opt1", "opt2", "opt3")',
                        },
                        title: {
                            type: 'string',
                            description: 'Short title for the fix approach (free-form text)',
                        },
                        description: {
                            type: 'string',
                            description: 'Detailed description of what this fix involves, how it addresses the root cause',
                        },
                        destination: {
                            type: 'string',
                            enum: ['implement', 'tech-design'],
                            description: 'Where this fix should be routed: "implement" for simple fixes, "tech-design" for complex changes needing design',
                        },
                        complexity: {
                            type: 'string',
                            enum: ['S', 'M', 'L', 'XL'],
                            description: 'Estimated complexity: S (few lines), M (moderate), L (significant), XL (major refactor)',
                        },
                        filesAffected: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'List of files that would be modified by this fix',
                        },
                        tradeoffs: {
                            type: 'string',
                            description: 'Trade-offs or considerations for this approach (optional)',
                        },
                        isRecommended: {
                            type: 'boolean',
                            description: 'Whether this is the recommended option. Only one option should be recommended.',
                        },
                    },
                    required: ['id', 'title', 'description', 'destination', 'complexity', 'filesAffected', 'isRecommended'],
                },
            },
            filesExamined: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of files that were examined during the investigation',
            },
            additionalLogsNeeded: {
                type: 'string',
                description: 'If root cause not found, describe what additional logs or information might help',
            },
            summary: {
                type: 'string',
                description:
                    'High-level summary of the investigation for GitHub comment. ' +
                    'Include: root cause (if found), confidence level, and brief overview of fix options. ' +
                    'Use markdown numbered list format.',
            },
            autoSubmit: {
                type: 'boolean',
                description:
                    'Set to true to auto-submit the recommended fix option WITHOUT requiring admin selection. ' +
                    'ONLY set this to true when ALL of these conditions are met: ' +
                    '(1) rootCauseFound is true, ' +
                    '(2) confidence is "high", ' +
                    '(3) there is exactly one obviously correct fix, ' +
                    '(4) the recommended fix has complexity "S" and destination "implement", ' +
                    '(5) the fix is straightforward with no meaningful trade-offs. ' +
                    'When in doubt, leave this false to let the admin choose.',
            },
        },
        required: ['rootCauseFound', 'confidence', 'rootCauseAnalysis', 'fixOptions', 'filesExamined', 'summary'],
    },
};
