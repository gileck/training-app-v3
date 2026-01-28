/**
 * Clarification API Types
 *
 * Types for the interactive clarification flow that allows
 * admins to answer agent clarification questions via a web UI.
 */

// ============================================================
// PARSED CLARIFICATION STRUCTURES
// ============================================================

/**
 * A single option in a clarification question
 */
export interface ParsedOption {
    /** Emoji indicator (✅ for recommended, ⚠️ for others) */
    emoji: string;
    /** Option label/name */
    label: string;
    /** Bullet point details */
    bullets: string[];
    /** Whether this is the recommended option */
    isRecommended: boolean;
}

/**
 * A parsed clarification question from agent output
 */
export interface ParsedQuestion {
    /** Context describing what's ambiguous or unclear */
    context: string;
    /** The specific question being asked */
    question: string;
    /** Available options to choose from */
    options: ParsedOption[];
    /** Agent's recommendation text */
    recommendation: string;
}

/**
 * Full parsed clarification data
 */
export interface ParsedClarification {
    /** The GitHub issue number */
    issueNumber: number;
    /** Issue title */
    issueTitle: string;
    /** The parsed questions */
    questions: ParsedQuestion[];
    /** Raw clarification content (for fallback display) */
    rawContent: string;
}

// ============================================================
// API REQUEST/RESPONSE TYPES
// ============================================================

/**
 * Request to get clarification data for an issue
 */
export interface GetClarificationRequest {
    /** GitHub issue number */
    issueNumber: number;
    /** Security token (8-char hash) */
    token: string;
}

/**
 * Response with clarification data
 */
export interface GetClarificationResponse {
    /** Parsed clarification data */
    clarification?: ParsedClarification;
    /** Error message if failed */
    error?: string;
}

/**
 * Answer to a single question
 */
export interface QuestionAnswer {
    /** Index of the question being answered */
    questionIndex: number;
    /** Selected option label (or "Other" for custom) */
    selectedOption: string;
    /** Custom text if "Other" was selected */
    customText?: string;
    /** Optional additional notes/context for any answer */
    additionalNotes?: string;
}

/**
 * Request to submit answers
 */
export interface SubmitAnswerRequest {
    /** GitHub issue number */
    issueNumber: number;
    /** Security token (8-char hash) */
    token: string;
    /** Answers to the questions */
    answers: QuestionAnswer[];
}

/**
 * Response after submitting answers
 */
export interface SubmitAnswerResponse {
    /** Whether submission was successful */
    success?: boolean;
    /** Error message if failed */
    error?: string;
}
