import type { PlanExerciseWithDefinition } from '@/apis/project/plan-exercises/types';
import type { ExerciseDefinitionClient } from '@/server/database/collections/project/exerciseDefinitions/types';
import type { PlanWorkoutClient } from '@/apis/project/plan-workouts/types';

// Multi-select exercise configuration
export interface MultiSelectExerciseConfig {
    exercise: ExerciseDefinitionClient;
    sets: number;
    reps: number;
    weight: number;
    comments: string;
}

// Common handler types for exercises
export interface ExerciseActionHandlers {
    onEdit: (exercise: PlanExerciseWithDefinition) => void;
    onDelete: (exercise: PlanExerciseWithDefinition) => void;
    onMove: (index: number, direction: 'up' | 'down') => void;
}

// Common handler types for workouts
export interface WorkoutActionHandlers {
    onEdit: (workout: PlanWorkoutClient) => void;
    onDelete: (workout: PlanWorkoutClient) => void;
    onDuplicate: (workout: PlanWorkoutClient) => void;
    onMove: (index: number, direction: 'up' | 'down') => void;
}

// Exercise definition action handlers
export interface ExerciseDefActionHandlers {
    onEditDef: (exercise: ExerciseDefinitionClient) => void;
    onDeleteDef: (exercise: ExerciseDefinitionClient) => void;
}
