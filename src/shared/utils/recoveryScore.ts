/**
 * Recovery Score Calculation (Isomorphic)
 *
 * Calculates a 0-100 recovery score based on recent training volume.
 * Uses exponential decay weighting - recent days impact score more than older days.
 *
 * High volume over consecutive days = low recovery score
 * Rest days = recovery score improves
 *
 * This module is isomorphic (works in both client and server environments).
 */

export interface DailySummary {
    date: string;           // ISO date string (YYYY-MM-DD)
    totalSets: number;
    totalExercises?: number;
    muscleGroups?: string[];
}

export interface RecoveryScoreResult {
    score: number;              // 0-100
    label: string;              // "Excellent", "Good", "Moderate", "Low", "Very Low"
    color: string;              // Tailwind color class
    dailyLoads: DailyLoad[];    // Per-day breakdown for dialog
    baseline: number;           // The "max" sets used as 100% load
}

export interface DailyLoad {
    date: string;
    sets: number;
    loadPercent: number;        // sets / baseline * 100
    weight: number;             // decay weight applied
    weightedLoad: number;       // loadPercent * weight
}

/**
 * Calculate the 75th percentile of an array of numbers
 */
function percentile75(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.75);
    return sorted[Math.min(idx, sorted.length - 1)];
}

/**
 * Get label and color based on score
 */
function getScoreLabel(score: number): { label: string; color: string } {
    if (score >= 80) return { label: 'Excellent', color: 'text-green-500' };
    if (score >= 60) return { label: 'Good', color: 'text-emerald-500' };
    if (score >= 40) return { label: 'Moderate', color: 'text-yellow-500' };
    if (score >= 20) return { label: 'Low', color: 'text-orange-500' };
    return { label: 'Very Low', color: 'text-red-500' };
}

/**
 * Calculate recovery score from daily summaries
 *
 * @param summaries - Daily summaries sorted by date descending (most recent first)
 * @param lookbackDays - Number of days to consider for weighted score (default 10)
 * @param baselineDays - Number of days to use for baseline calculation (default 30)
 */
export function calculateRecoveryScore(
    summaries: DailySummary[],
    lookbackDays: number = 10,
    baselineDays: number = 30
): RecoveryScoreResult {
    // Build a map of date -> totalSets for quick lookup
    const setsByDate = new Map<string, number>();
    summaries.forEach(s => setsByDate.set(s.date, s.totalSets));

    // Get the last N days (including days with 0 sets)
    const today = new Date();
    const recentDays: { date: string; sets: number }[] = [];

    for (let i = 0; i < Math.max(lookbackDays, baselineDays); i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        recentDays.push({
            date: dateStr,
            sets: setsByDate.get(dateStr) ?? 0,
        });
    }

    // Calculate baseline from 75th percentile of last 30 days
    // Only consider days with activity for the percentile
    const daysWithActivity = recentDays
        .slice(0, baselineDays)
        .filter(d => d.sets > 0)
        .map(d => d.sets);

    // Use 75th percentile with a floor of 12 sets
    const calculatedBaseline = percentile75(daysWithActivity);
    const baseline = Math.max(calculatedBaseline, 12);

    // Calculate weighted load for the lookback period
    // Exponential decay: weight = 0.8^dayIndex
    const dailyLoads: DailyLoad[] = [];
    let weightedLoadSum = 0;
    let totalWeight = 0;

    for (let i = 0; i < lookbackDays; i++) {
        const day = recentDays[i];
        const weight = Math.pow(0.8, i);
        const loadPercent = (day.sets / baseline) * 100;
        const weightedLoad = loadPercent * weight;

        dailyLoads.push({
            date: day.date,
            sets: day.sets,
            loadPercent: Math.round(loadPercent),
            weight: Math.round(weight * 100) / 100,
            weightedLoad: Math.round(weightedLoad * 100) / 100,
        });

        weightedLoadSum += weightedLoad;
        totalWeight += weight;
    }

    // Calculate average weighted load (0-100+ scale)
    const avgWeightedLoad = weightedLoadSum / totalWeight;

    // Convert to recovery score (invert: high load = low recovery)
    // Cap load at 150% so recovery can go to 0 but not negative
    const cappedLoad = Math.min(avgWeightedLoad, 150);
    const score = Math.round(Math.max(0, 100 - (cappedLoad * 100 / 150)));

    const { label, color } = getScoreLabel(score);

    return {
        score,
        label,
        color,
        dailyLoads,
        baseline: Math.round(baseline),
    };
}
