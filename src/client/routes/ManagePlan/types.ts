import type { PlanExerciseWithDefinition } from '@/apis/plan-exercises/types';
import type { ExerciseDefinitionClient } from '@/server/database/collections/exerciseDefinitions/types';
import type { SavedWorkoutWithExercises } from '@/apis/saved-workouts/types';

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
    onEdit: (workout: SavedWorkoutWithExercises) => void;
    onDelete: (workout: SavedWorkoutWithExercises) => void;
    onDuplicate: (workout: SavedWorkoutWithExercises) => void;
    onMove: (index: number, direction: 'up' | 'down') => void;
}

// Exercise definition action handlers
export interface ExerciseDefActionHandlers {
    onEditDef: (exercise: ExerciseDefinitionClient) => void;
    onDeleteDef: (exercise: ExerciseDefinitionClient) => void;
}
