import type { PlanExerciseWithDefinition } from '@/apis/plan-exercises/types';
import type { ExerciseGroupBy } from '../../store';
import { PlanExerciseCard } from './PlanExerciseCard';

interface PlanExerciseListProps {
    exercises: PlanExerciseWithDefinition[];
    isReorderMode: boolean;
    isReorderPending: boolean;
    groupBy: ExerciseGroupBy;
    onEdit: (exercise: PlanExerciseWithDefinition) => void;
    onDelete: (exercise: PlanExerciseWithDefinition) => void;
    onMove: (index: number, direction: 'up' | 'down') => void;
}

interface ExerciseGroup {
    name: string;
    exercises: PlanExerciseWithDefinition[];
    totalSets: number;
}

function groupExercises(exercises: PlanExerciseWithDefinition[], groupBy: ExerciseGroupBy): ExerciseGroup[] {
    if (groupBy === 'none') {
        return [{ name: '', exercises, totalSets: 0 }];
    }

    const groups = new Map<string, PlanExerciseWithDefinition[]>();

    for (const exercise of exercises) {
        const key = groupBy === 'primaryMuscle'
            ? exercise.exerciseDef.primaryMuscle
            : exercise.exerciseDef.type;

        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(exercise);
    }

    // Sort groups by number of exercises (descending)
    return Array.from(groups.entries())
        .sort((a, b) => b[1].length - a[1].length)
        .map(([name, exercises]) => ({
            name,
            exercises,
            totalSets: exercises.reduce((sum, ex) => sum + ex.sets, 0),
        }));
}

export function PlanExerciseList({
    exercises,
    isReorderMode,
    isReorderPending,
    groupBy,
    onEdit,
    onDelete,
    onMove,
}: PlanExerciseListProps) {
    const groups = groupExercises(exercises, groupBy);

    // When not grouping, render flat list
    if (groupBy === 'none') {
        return (
            <div className="space-y-3">
                {exercises.map((exercise, index) => (
                    <PlanExerciseCard
                        key={exercise._id}
                        exercise={exercise}
                        index={index}
                        isFirst={index === 0}
                        isLast={index === exercises.length - 1}
                        isReorderMode={isReorderMode}
                        isReorderPending={isReorderPending}
                        onEdit={() => onEdit(exercise)}
                        onDelete={() => onDelete(exercise)}
                        onMoveUp={() => onMove(index, 'up')}
                        onMoveDown={() => onMove(index, 'down')}
                    />
                ))}
            </div>
        );
    }

    // When grouping, render with group headers
    return (
        <div className="space-y-4">
            {groups.map((group) => (
                <div key={group.name} className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                        <h3 className="text-sm font-semibold text-muted-foreground">
                            {group.name}
                        </h3>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {group.exercises.length} exercises
                        </span>
                        <span className="text-xs text-muted-foreground">
                            · {group.totalSets} sets
                        </span>
                    </div>
                    <div className="space-y-3">
                        {group.exercises.map((exercise) => {
                            const originalIndex = exercises.findIndex(e => e._id === exercise._id);
                            return (
                                <PlanExerciseCard
                                    key={exercise._id}
                                    exercise={exercise}
                                    index={originalIndex}
                                    isFirst={originalIndex === 0}
                                    isLast={originalIndex === exercises.length - 1}
                                    isReorderMode={isReorderMode}
                                    isReorderPending={isReorderPending}
                                    onEdit={() => onEdit(exercise)}
                                    onDelete={() => onDelete(exercise)}
                                    onMoveUp={() => onMove(originalIndex, 'up')}
                                    onMoveDown={() => onMove(originalIndex, 'down')}
                                />
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
