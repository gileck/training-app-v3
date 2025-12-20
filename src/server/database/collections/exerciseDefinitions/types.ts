import { ObjectId } from 'mongodb';

/**
 * Represents an exercise definition in the system
 * Can be a system exercise (shared) or user-created custom exercise
 */
export interface ExerciseDefinition {
    _id: ObjectId;
    name: string;
    imageUrl: string;
    primaryMuscle: string;
    secondaryMuscles: string[];
    type: string;
    isBodyweight: boolean;
    isStatic: boolean;
    isSystem: boolean;
    userId?: ObjectId; // Only set for custom user exercises
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Type for creating a new exercise definition
 */
export type ExerciseDefinitionCreate = Omit<ExerciseDefinition, '_id'>;

/**
 * Type for updating an exercise definition
 */
export type ExerciseDefinitionUpdate = Partial<
    Omit<ExerciseDefinition, '_id' | 'isSystem' | 'userId'>
> & {
    updatedAt: Date;
};

/**
 * Client-friendly exercise definition with string IDs
 */
export interface ExerciseDefinitionClient {
    _id: string;
    name: string;
    imageUrl: string;
    primaryMuscle: string;
    secondaryMuscles: string[];
    type: string;
    isBodyweight: boolean;
    isStatic: boolean;
    isSystem: boolean;
    userId?: string;
    createdAt: string;
    updatedAt: string;
}

