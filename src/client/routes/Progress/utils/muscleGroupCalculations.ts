import type { DailySummary } from '@/apis/activity-logs/types';

export interface MuscleGroupData {
    muscle: string;
    daysCount: number;
    intensity: 'heavy' | 'moderate' | 'light' | 'not-trained';
}

/**
 * Normalize muscle name for case-insensitive matching
 */
export function normalizeMuscle(muscle: string): string {
    return muscle.toLowerCase().trim();
}

/**
 * Get intensity category based on days count
 */
export function getIntensityCategory(daysCount: number): 'heavy' | 'moderate' | 'light' | 'not-trained' {
    if (daysCount >= 10) return 'heavy';
    if (daysCount >= 5) return 'moderate';
    if (daysCount >= 1) return 'light';
    return 'not-trained';
}

/**
 * Get Tailwind color classes based on intensity level
 */
export function getIntensityColor(intensity: 'heavy' | 'moderate' | 'light' | 'not-trained'): string {
    switch (intensity) {
        case 'heavy':
            return 'bg-primary';
        case 'moderate':
            return 'bg-blue-500/70';
        case 'light':
            return 'bg-yellow-500/50';
        case 'not-trained':
            return 'bg-muted border border-dashed border-muted-foreground/30';
    }
}

/**
 * Calculate unique days each muscle was trained (not total frequency)
 *
 * @param summaries - Daily summaries from activity data
 * @param allMuscleGroups - All muscle groups from exercise library
 * @returns Array of muscle group data with counts and intensity levels, sorted by frequency
 */
export function calculateMuscleGroupData(
    summaries: DailySummary[],
    allMuscleGroups: string[]
): MuscleGroupData[] {
    // Count unique days each muscle was trained
    const muscleFrequency = new Map<string, Set<string>>();

    // Track which dates each muscle appears in
    summaries.forEach((summary) => {
        summary.muscleGroups.forEach((muscle) => {
            const normalized = normalizeMuscle(muscle);
            if (!muscleFrequency.has(normalized)) {
                muscleFrequency.set(normalized, new Set());
            }
            muscleFrequency.get(normalized)!.add(summary.date);
        });
    });

    // Create data for all muscle groups
    const muscleData: MuscleGroupData[] = allMuscleGroups.map((muscle) => {
        const normalized = normalizeMuscle(muscle);
        const daysSet = muscleFrequency.get(normalized);
        const daysCount = daysSet ? daysSet.size : 0;
        const intensity = getIntensityCategory(daysCount);

        return {
            muscle,
            daysCount,
            intensity,
        };
    });

    // Sort by frequency (most trained first, untrained at bottom)
    muscleData.sort((a, b) => {
        // If counts are different, sort by count (descending)
        if (a.daysCount !== b.daysCount) {
            return b.daysCount - a.daysCount;
        }
        // If counts are equal, sort alphabetically
        return a.muscle.localeCompare(b.muscle);
    });

    return muscleData;
}
