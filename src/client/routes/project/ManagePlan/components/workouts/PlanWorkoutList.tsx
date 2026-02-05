import type { PlanWorkoutClient } from '@/apis/project/plan-workouts/types';
import type { PlanExerciseWithDefinition } from '@/apis/project/plan-exercises/types';
import { PlanWorkoutCard } from './PlanWorkoutCard';

interface PlanWorkoutListProps {
    workouts: PlanWorkoutClient[];
    planExercises: PlanExerciseWithDefinition[];
    expandedWorkoutId: string | null;
    isReorderMode: boolean;
    isReorderPending: boolean;
    isDuplicatePending: boolean;
    onToggleExpand: (workoutId: string) => void;
    onEdit: (workout: PlanWorkoutClient) => void;
    onDuplicate: (workout: PlanWorkoutClient) => void;
    onDelete: (workout: PlanWorkoutClient) => void;
    onMove: (index: number, direction: 'up' | 'down') => void;
}

export function PlanWorkoutList({
    workouts,
    planExercises,
    expandedWorkoutId,
    isReorderMode,
    isReorderPending,
    isDuplicatePending,
    onToggleExpand,
    onEdit,
    onDuplicate,
    onDelete,
    onMove,
}: PlanWorkoutListProps) {
    return (
        <div className="space-y-3">
            {workouts.map((workout, index) => (
                <PlanWorkoutCard
                    key={workout._id}
                    workout={workout}
                    planExercises={planExercises}
                    index={index}
                    isFirst={index === 0}
                    isLast={index === workouts.length - 1}
                    isExpanded={expandedWorkoutId === workout._id}
                    isReorderMode={isReorderMode}
                    isReorderPending={isReorderPending}
                    isDuplicatePending={isDuplicatePending}
                    onToggleExpand={() => onToggleExpand(workout._id)}
                    onEdit={() => onEdit(workout)}
                    onDuplicate={() => onDuplicate(workout)}
                    onDelete={() => onDelete(workout)}
                    onMoveUp={() => onMove(index, 'up')}
                    onMoveDown={() => onMove(index, 'down')}
                />
            ))}
        </div>
    );
}
