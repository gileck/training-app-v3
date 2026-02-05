import type { PlanExerciseWithDefinition } from '@/apis/project/plan-exercises/types';
import { PlanExerciseCard } from './PlanExerciseCard';

interface PlanExerciseListProps {
    exercises: PlanExerciseWithDefinition[];
    isReorderMode: boolean;
    isReorderPending: boolean;
    onEdit: (exercise: PlanExerciseWithDefinition) => void;
    onDelete: (exercise: PlanExerciseWithDefinition) => void;
    onMove: (index: number, direction: 'up' | 'down') => void;
}

export function PlanExerciseList({
    exercises,
    isReorderMode,
    isReorderPending,
    onEdit,
    onDelete,
    onMove,
}: PlanExerciseListProps) {
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
