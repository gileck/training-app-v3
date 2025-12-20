import { ObjectId } from 'mongodb';

export interface SavedWorkoutExercise {
    exerciseDefId: ObjectId;
    sets: number;
    reps: number;
    weight: number;
    durationSeconds: number;
    order: number;
}

export interface SavedWorkout {
    _id: ObjectId;
    userId: ObjectId;
    name: string;
    exercises: SavedWorkoutExercise[];
    createdAt: Date;
    updatedAt: Date;
}

export type SavedWorkoutCreate = Omit<SavedWorkout, '_id' | 'createdAt' | 'updatedAt'>;
export type SavedWorkoutUpdate = Partial<Omit<SavedWorkout, '_id' | 'userId' | 'createdAt'>> & {
    updatedAt: Date;
};

// Client types
export interface SavedWorkoutExerciseClient {
    exerciseDefId: string;
    sets: number;
    reps: number;
    weight: number;
    durationSeconds: number;
    order: number;
}

export interface SavedWorkoutClient {
    _id: string;
    userId: string;
    name: string;
    exercises: SavedWorkoutExerciseClient[];
    createdAt: string;
    updatedAt: string;
}


