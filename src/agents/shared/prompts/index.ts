/**
 * Prompt Templates for Agent Scripts
 *
 * This module exports all prompt templates organized by workflow phase:
 *
 * - **Shared Instructions**: Reusable instruction blocks (ambiguity handling, markdown formatting)
 * - **Product Development**: Optional phase for vague feature ideas → concrete specs
 * - **Product Design**: UI/UX design phase (HOW it looks and feels)
 * - **Technical Design**: Technical implementation planning (HOW to build it)
 * - **Implementation**: Actual code writing based on approved designs
 * - **Bug Fix**: Bug-specific design and implementation prompts
 * - **Plan Subagent**: Implementation planning before main implementation
 */

// Shared instructions
export { AMBIGUITY_INSTRUCTIONS, MARKDOWN_FORMATTING_INSTRUCTIONS } from './shared-instructions';

// Product Development prompts
export {
    buildProductDevelopmentPrompt,
    buildProductDevelopmentRevisionPrompt,
    buildProductDevelopmentClarificationPrompt,
} from './product-development';

// Product Design prompts
export {
    buildProductDesignPrompt,
    buildProductDesignRevisionPrompt,
    buildProductDesignClarificationPrompt,
} from './product-design';

// Technical Design prompts
export {
    buildTechDesignPrompt,
    buildTechDesignRevisionPrompt,
    buildTechDesignClarificationPrompt,
} from './technical-design';

// Implementation prompts
export {
    buildImplementationPrompt,
    buildPRRevisionPrompt,
    buildImplementationClarificationPrompt,
} from './implementation';

// Bug Fix prompts (implementation only - bug investigation prompts are in bug-investigation.ts)
export { buildBugImplementationPrompt } from './bug-fix';

// Bug Investigation prompts
export {
    buildBugInvestigationPrompt,
    buildBugInvestigationRevisionPrompt,
    buildBugInvestigationClarificationPrompt,
} from './bug-investigation';

// Plan Subagent prompt
export { buildPlanSubagentPrompt } from './plan-subagent';
