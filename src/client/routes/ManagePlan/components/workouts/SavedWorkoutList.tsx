import type { SavedWorkoutWithExercises } from '@/apis/saved-workouts/types';
import { SavedWorkoutCard } from './SavedWorkoutCard';

interface SavedWorkoutListProps {
    workouts: SavedWorkoutWithExercises[];
    expandedWorkoutId: string | null;
    isReorderMode: boolean;
    isReorderPending: boolean;
    isDuplicatePending: boolean;
    onToggleExpand: (workoutId: string) => void;
    onEdit: (workout: SavedWorkoutWithExercises) => void;
    onDuplicate: (workout: SavedWorkoutWithExercises) => void;
    onDelete: (workout: SavedWorkoutWithExercises) => void;
    onMove: (index: number, direction: 'up' | 'down') => void;
}

export function SavedWorkoutList({
    workouts,
    expandedWorkoutId,
    isReorderMode,
    isReorderPending,
    isDuplicatePending,
    onToggleExpand,
    onEdit,
    onDuplicate,
    onDelete,
    onMove,
}: SavedWorkoutListProps) {
    return (
        <div className="space-y-3">
            {workouts.map((workout, index) => (
                <SavedWorkoutCard
                    key={workout._id}
                    workout={workout}
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
