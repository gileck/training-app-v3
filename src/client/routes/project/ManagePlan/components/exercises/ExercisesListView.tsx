/**
 * ExercisesTab List View Component
 */

import type { PlanExerciseWithDefinition } from '@/apis/project/plan-exercises/types';
import { PlanExerciseList } from './PlanExerciseList';

interface ExercisesListViewProps {
    planExercises: PlanExerciseWithDefinition[];
    groupedExercises: [string, PlanExerciseWithDefinition[]][] | null;
    isReorderMode: boolean;
    isReorderPending: boolean;
    onEdit: (exercise: PlanExerciseWithDefinition) => void;
    onDelete: (exercise: PlanExerciseWithDefinition) => void;
    onMove: (index: number, direction: 'up' | 'down') => void;
}

export function ExercisesListView({
    planExercises,
    groupedExercises,
    isReorderMode,
    isReorderPending,
    onEdit,
    onDelete,
    onMove,
}: ExercisesListViewProps) {
    if (groupedExercises) {
        return (
            <div className="space-y-6">
                {groupedExercises.map(([groupName, exercises]) => {
                    const totalSets = exercises.reduce((sum, ex) => sum + ex.sets, 0);
                    return (
                        <div key={groupName}>
                            <div className="py-2 mb-2 border-b border-border flex items-center gap-2">
                                <h3 className="font-semibold text-sm text-foreground">
                                    {groupName}
                                </h3>
                                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-muted text-xs font-medium text-muted-foreground">
                                    {exercises.length}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    · {totalSets} sets
                                </span>
                            </div>
                            <PlanExerciseList
                                exercises={exercises}
                                isReorderMode={false}
                                isReorderPending={false}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onMove={() => {}}
                            />
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <PlanExerciseList
            exercises={planExercises}
            isReorderMode={isReorderMode}
            isReorderPending={isReorderPending}
            onEdit={onEdit}
            onDelete={onDelete}
            onMove={onMove}
        />
    );
}
