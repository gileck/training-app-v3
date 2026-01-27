/**
 * Output Schemas for Agent Structured Outputs
 *
 * Defines TypeScript interfaces and JSON schemas for structured outputs
 * from product-development, product-design, tech-design, and implement agents.
 */

// ============================================================
// PRODUCT DEVELOPMENT OUTPUT
// ============================================================

export interface ProductDevelopmentOutput {
    document: string;
    comment: string;
}

export const PRODUCT_DEVELOPMENT_OUTPUT_FORMAT = {
    type: 'json_schema' as const,
    schema: {
        type: 'object',
        properties: {
            document: {
                type: 'string',
                description: 'Complete product development document in markdown format. ' +
                    'Should include: size estimate, problem statement, target users, ' +
                    'requirements with acceptance criteria, success metrics, scope (in/out).',
            },
            comment: {
                type: 'string',
                description:
                    'High-level summary to post as GitHub comment. ' +
                    'For new documents: "Here\'s the product spec overview: 1. ... 2. ..." (3-5 items). ' +
                    'For revisions: "Here\'s what I changed: 1. ... 2. ..." (list specific changes made).',
            },
        },
        required: ['document', 'comment'],
    },
};

// ============================================================
// PRODUCT DESIGN OUTPUT
// ============================================================

export interface ProductDesignOutput {
    design: string;
    comment: string;
}

export const PRODUCT_DESIGN_OUTPUT_FORMAT = {
    type: 'json_schema' as const,
    schema: {
        type: 'object',
        properties: {
            design: {
                type: 'string',
                description: 'Complete product design document in markdown format',
            },
            comment: {
                type: 'string',
                description:
                    'High-level summary to post as GitHub comment. ' +
                    'For new designs: "Here\'s the design overview: 1. ... 2. ..." (3-5 items). ' +
                    'For revisions: "Here\'s what I changed: 1. ... 2. ..." (list specific changes made).',
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

export interface TechDesignOutput {
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
            design: {
                type: 'string',
                description: 'Complete technical design document in markdown format',
            },
            phases: {
                type: 'array',
                description:
                    'Implementation phases for L/XL features only. Split large features into multiple ' +
                    'independently mergeable phases, each of size S or M. Each phase should be a complete, ' +
                    'testable unit of work. Leave empty/null for S/M features that can be done in a single PR.',
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
                    'For revisions: "Here\'s what I changed: 1. ... 2. ..." (list specific changes made).',
            },
        },
        required: ['design', 'comment'],
    },
};

// ============================================================
// IMPLEMENTATION OUTPUT
// ============================================================

export interface ImplementationOutput {
    prSummary: string;
    comment: string;
}

export const IMPLEMENTATION_OUTPUT_FORMAT = {
    type: 'json_schema' as const,
    schema: {
        type: 'object',
        properties: {
            prSummary: {
                type: 'string',
                description: 'Complete PR description in markdown format',
            },
            comment: {
                type: 'string',
                description:
                    'High-level summary of what was done to post as GitHub comment. ' +
                    'For new implementations: "Here\'s what I did: 1. ... 2. ..." (3-5 items). ' +
                    'For revisions: "Here\'s what I changed: 1. ... 2. ..." (list specific changes made).',
            },
        },
        required: ['prSummary', 'comment'],
    },
};
