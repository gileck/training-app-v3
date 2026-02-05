/**
 * Exercise Matcher
 * 
 * Matches AI-generated exercise names to existing exercise definitions.
 * Uses deterministic string matching with muscle-aware scoring.
 */

import type { ExerciseDefinition } from '@/server/database/collections/project/exerciseDefinitions/types';
import type { SuggestedMatch, ExerciseMatchStatus } from '../types';
import { toStringId } from '@/server/utils';

export interface MatchResult {
    status: ExerciseMatchStatus;
    exerciseDefId?: string;
    exerciseName?: string;
    suggestedMatches?: SuggestedMatch[];
}

// Number of suggestions to return for unresolved exercises
const MAX_SUGGESTIONS = 5;

// Minimum score threshold for suggestions (0-100)
const MIN_SUGGESTION_SCORE = 30;

// Muscle match bonus (added to score when muscles match)
const MUSCLE_MATCH_BONUS = 15;

/**
 * Normalize exercise name for comparison
 * - lowercase
 * - remove extra whitespace
 * - remove common prefixes/suffixes
 * - normalize singular/plural muscle names
 */
function normalizeExerciseName(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        // Remove possessive 's (farmer's → farmer, landmine's → landmine)
        .replace(/'s\b/g, '')
        // Remove standalone apostrophes (shouldn't happen but just in case)
        .replace(/'/g, '')
        // Remove common equipment prefixes
        .replace(/^(barbell|dumbbell|kettlebell|cable|machine|smith machine|ez bar|ez-bar)\s+/i, '')
        // Remove common suffixes
        .replace(/\s+(exercise|movement|lift)$/i, '')
        // Normalize common abbreviations
        .replace(/\bdb\b/gi, 'dumbbell')
        .replace(/\bbb\b/gi, 'barbell')
        .replace(/\bkb\b/gi, 'kettlebell')
        // Normalize singular/plural muscle names (bicep→biceps, tricep→triceps, etc.)
        .replace(/\bbicep\b/gi, 'biceps')
        .replace(/\btricep\b/gi, 'triceps')
        .replace(/\bquad\b/gi, 'quads')
        .replace(/\bglute\b/gi, 'glutes')
        .replace(/\bcalf\b/gi, 'calves')
        .replace(/\bdelt\b/gi, 'delts')
        .replace(/\btrap\b/gi, 'traps')
        .replace(/\blat\b/gi, 'lats')
        .replace(/\bab\b/gi, 'abs')
        // Normalize common exercise name variations (hyphenated → non-hyphenated)
        .replace(/\bpull-up\b/gi, 'pullup')
        .replace(/\bpull-down\b/gi, 'pulldown')
        .replace(/\bpull-downs\b/gi, 'pulldown')
        .replace(/\bpulldowns\b/gi, 'pulldown')
        .replace(/\bpush-up\b/gi, 'pushup')
        .replace(/\bsit-up\b/gi, 'situp')
        .replace(/\bstep-up\b/gi, 'stepup')
        .replace(/\bface-pull\b/gi, 'facepull')
        // Normalize plural variations
        .replace(/\bpullups\b/gi, 'pullup')
        .replace(/\bpushups\b/gi, 'pushup')
        .replace(/\bsitups\b/gi, 'situp')
        .replace(/\bstepups\b/gi, 'stepup')
        // Remove remaining hyphens between words (general fallback)
        .replace(/-/g, '');
}

/**
 * Try to infer the primary muscle from exercise name
 * Returns null if can't determine
 */
function inferMuscleFromName(name: string): string | null {
    const lowerName = name.toLowerCase();
    
    const muscleKeywords: Record<string, string[]> = {
        'Chest': ['bench', 'chest', 'fly', 'pec', 'push-up', 'pushup'],
        'Back': ['row', 'pull-up', 'pullup', 'lat', 'back', 'deadlift'],
        'Shoulders': ['shoulder', 'delt', 'overhead press', 'military press', 'lateral raise', 'front raise'],
        'Biceps': ['bicep', 'curl', 'hammer'],
        'Triceps': ['tricep', 'pushdown', 'skull crusher', 'dip', 'extension'],
        'Quadriceps': ['squat', 'leg press', 'lunge', 'quad', 'leg extension'],
        'Hamstrings': ['hamstring', 'leg curl', 'romanian', 'stiff leg'],
        'Glutes': ['glute', 'hip thrust', 'bridge'],
        'Calves': ['calf', 'calves', 'heel raise'],
        'Abs': ['ab', 'crunch', 'plank', 'sit-up', 'situp', 'core'],
    };
    
    for (const [muscle, keywords] of Object.entries(muscleKeywords)) {
        if (keywords.some(kw => lowerName.includes(kw))) {
            return muscle;
        }
    }
    
    return null;
}

/**
 * Calculate similarity score between two strings (0-100)
 * Uses Levenshtein distance normalized by string length
 */
function stringSimilarity(a: string, b: string): number {
    if (a === b) return 100;
    if (a.length === 0 || b.length === 0) return 0;
    
    const matrix: number[][] = [];
    
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }
    
    const maxLen = Math.max(a.length, b.length);
    return Math.round((1 - matrix[b.length][a.length] / maxLen) * 100);
}

/**
 * Check if one string contains the other as a meaningful substring
 */
function containsMatch(needle: string, haystack: string): boolean {
    const normalizedNeedle = normalizeExerciseName(needle);
    const normalizedHaystack = normalizeExerciseName(haystack);
    
    // Check direct containment
    if (normalizedHaystack.includes(normalizedNeedle)) return true;
    if (normalizedNeedle.includes(normalizedHaystack)) return true;
    
    return false;
}

/**
 * Calculate match score between an input name and a library exercise
 * Returns score 0-100+, accounting for muscle match bonus
 */
function calculateMatchScore(
    inputName: string,
    inputMuscle: string | null,
    libraryExercise: ExerciseDefinition
): number {
    const normalizedInput = normalizeExerciseName(inputName);
    const normalizedLib = normalizeExerciseName(libraryExercise.name);
    
    // Base score from string similarity
    let score = stringSimilarity(normalizedInput, normalizedLib);
    
    // Boost for containment match
    if (containsMatch(inputName, libraryExercise.name)) {
        score = Math.max(score, 60); // At least 60 for containment
    }
    
    // Check main exercise words
    const mainExerciseWords = ['squat', 'press', 'row', 'curl', 'deadlift', 'bench', 
        'pullup', 'pull-up', 'pushup', 'push-up', 'lunge', 'fly', 'raise', 
        'extension', 'crunch', 'plank', 'dip', 'shrug'];
    
    const inputWords = normalizedInput.split(' ');
    const libWords = normalizedLib.split(' ');
    
    for (const word of inputWords) {
        if (mainExerciseWords.includes(word) && libWords.includes(word)) {
            score = Math.max(score, 55); // At least 55 for main word match
            break;
        }
    }
    
    // Muscle match bonus
    if (inputMuscle && libraryExercise.primaryMuscle === inputMuscle) {
        score += MUSCLE_MATCH_BONUS;
    }
    
    return score;
}

/**
 * Match an exercise name against a list of exercise definitions
 * 
 * Returns:
 * - status: 'matched' if exact/normalized match found in SYSTEM exercises only
 * - status: 'unresolved' if no match, with suggestions from system exercises
 * 
 * IMPORTANT: Only matches against system (library) exercises, never custom exercises.
 * Custom exercises often lack proper metadata (images, muscle groups).
 * If no system match is found, returns unresolved so user can manually resolve.
 */
export function matchExercise(
    name: string,
    exerciseLibrary: ExerciseDefinition[]
): MatchResult {
    const normalizedInput = normalizeExerciseName(name);
    const inferredMuscle = inferMuscleFromName(name);
    
    // Only match against SYSTEM exercises (library exercises with proper metadata)
    const systemExercises = exerciseLibrary.filter(def => def.isSystem);
    
    // First, try exact match against SYSTEM exercises
    for (const def of systemExercises) {
        if (name.toLowerCase().trim() === def.name.toLowerCase().trim()) {
            return {
                status: 'matched',
                exerciseDefId: toStringId(def._id),
                exerciseName: def.name,
            };
        }
    }
    
    // Second, try normalized match against SYSTEM exercises
    for (const def of systemExercises) {
        const normalizedDef = normalizeExerciseName(def.name);
        if (normalizedInput === normalizedDef) {
            return {
                status: 'matched',
                exerciseDefId: toStringId(def._id),
                exerciseName: def.name,
            };
        }
    }
    
    // No match in system exercises - do NOT fallback to custom exercises
    
    // No exact/normalized match - calculate scores and return suggestions
    // Suggestions include ALL exercises (system + custom) for manual resolution dialog
    const scoredExercises: Array<{
        def: ExerciseDefinition;
        score: number;
    }> = [];
    
    for (const def of exerciseLibrary) {
        const score = calculateMatchScore(name, inferredMuscle, def);
        if (score >= MIN_SUGGESTION_SCORE) {
            scoredExercises.push({ def, score });
        }
    }
    
    // Sort by score descending, with system exercises preferred over custom at same score
    scoredExercises.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        // At same score, prefer system exercises (they have better metadata)
        if (a.def.isSystem && !b.def.isSystem) return -1;
        if (!a.def.isSystem && b.def.isSystem) return 1;
        return 0;
    });
    
    // Take top N suggestions (handles both ObjectId and UUID)
    const suggestions: SuggestedMatch[] = scoredExercises
        .slice(0, MAX_SUGGESTIONS)
        .map(({ def, score }) => ({
            exerciseDefId: toStringId(def._id),
            name: def.name,
            primaryMuscle: def.primaryMuscle,
            imageUrl: def.imageUrl,
            score: Math.min(score, 100), // Cap at 100
            isSystem: def.isSystem,
        }));

    
    return {
        status: 'unresolved',
        suggestedMatches: suggestions,
    };
}
