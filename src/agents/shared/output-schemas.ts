/**
 * Output Schemas for Agent Structured Outputs
 *
 * Defines TypeScript interfaces and JSON schemas for structured outputs
 * from product-design, tech-design, and implement agents.
 */

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

export interface TechDesignOutput {
    design: string;
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
