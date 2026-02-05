import type { ActivityLogEntry } from '@/apis/project/activity-logs/types';

export function formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
}

export function formatTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
    });
}

export interface ActivityGroup {
    type: 'single' | 'grouped';
    exerciseName: string;
    activities: ActivityLogEntry[];
    firstTime: string;
}

/**
 * Groups consecutive activities by exercise name if they are within 10 minutes of each other.
 * Non-consecutive exercises or exercises more than 10 minutes apart are not grouped.
 */
export function groupConsecutiveActivities(activities: ActivityLogEntry[]): ActivityGroup[] {
    if (activities.length === 0) return [];

    const MAX_TIME_GAP_MS = 10 * 60 * 1000; // 10 minutes in milliseconds
    const groups: ActivityGroup[] = [];
    let currentGroup: ActivityLogEntry[] = [activities[0]];

    for (let i = 1; i < activities.length; i++) {
        const current = activities[i];
        const previous = activities[i - 1];

        const currentTime = new Date(current.completedAt).getTime();
        const previousTime = new Date(previous.completedAt).getTime();
        const timeDiff = Math.abs(currentTime - previousTime);

        const sameExercise = current.exerciseName === previous.exerciseName;
        const withinTimeLimit = timeDiff <= MAX_TIME_GAP_MS;

        if (sameExercise && withinTimeLimit) {
            // Add to current group
            currentGroup.push(current);
        } else {
            // Finalize current group and start a new one
            groups.push({
                type: currentGroup.length > 1 ? 'grouped' : 'single',
                exerciseName: currentGroup[0].exerciseName,
                activities: currentGroup,
                firstTime: currentGroup[0].completedAt,
            });
            currentGroup = [current];
        }
    }

    // Don't forget to add the last group
    groups.push({
        type: currentGroup.length > 1 ? 'grouped' : 'single',
        exerciseName: currentGroup[0].exerciseName,
        activities: currentGroup,
        firstTime: currentGroup[0].completedAt,
    });

    return groups;
}
