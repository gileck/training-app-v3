/**
 * Export Plan Handler
 * 
 * Exports a training plan to JSON format including:
 * - Plan metadata (name, duration)
 * - Workouts with exercises
 * - Exercise definition IDs for fast matching on import
 */

import type { 
    ApiHandlerContext, 
    ExportPlanRequest, 
    ExportPlanResponse,
    PlanExportData,
    ExportWorkout,
    ExportExercise,
} from '../types';
import { trainingPlans, planExercises, exerciseDefinitions, planWorkouts } from '@/server/database';
import { toStringId } from '@/server/utils';

const EXPORT_VERSION = '1.0';

export async function exportPlan(
    request: ExportPlanRequest,
    context: ApiHandlerContext
): Promise<ExportPlanResponse> {
    try {
        // Auth check
        if (!context.userId) {
            return {
                error: 'Not authenticated',
                errorCode: 'UNAUTHORIZED',
            };
        }

        // Validate request
        if (!request.planId) {
            return {
                error: 'Plan ID is required',
                errorCode: 'VALIDATION',
            };
        }

        // Fetch the plan
        const plan = await trainingPlans.findPlanById(request.planId, context.userId);
        if (!plan) {
            return {
                error: 'This plan no longer exists. It may have been deleted.',
                errorCode: 'PLAN_NOT_FOUND',
            };
        }

        // Fetch all plan exercises
        const planExercisesList = await planExercises.findExercisesByPlanId(request.planId);

        // Get all unique exercise definition IDs
        const exerciseDefIds = [...new Set(planExercisesList.map(pe => toStringId(pe.exerciseDefId)))];

        // Batch fetch exercise definitions for names (single query instead of N queries)
        const exerciseDefList = await exerciseDefinitions.findExercisesByIds(exerciseDefIds);
        const exerciseDefMap = new Map<string, { name: string }>();
        for (const def of exerciseDefList) {
            exerciseDefMap.set(toStringId(def._id), { name: def.name });
        }

        // Build map of planExerciseId -> exercise data
        const planExerciseMap = new Map<string, {
            name: string;
            exerciseDefId: string;
            sets: number;
            reps: number;
            weight: number;
            durationSeconds: number;
            comments: string;
        }>();

        for (const pe of planExercisesList) {
            const exerciseDefId = toStringId(pe.exerciseDefId);
            const def = exerciseDefMap.get(exerciseDefId);
            planExerciseMap.set(toStringId(pe._id), {
                name: def?.name || 'Unknown Exercise',
                exerciseDefId,
                sets: pe.sets,
                reps: pe.reps,
                weight: pe.weight,
                durationSeconds: pe.durationSeconds,
                comments: pe.comments,
            });
        }

        // Fetch plan workouts
        const workoutsList = await planWorkouts.listPlanWorkouts(context.userId, request.planId);

        // Build export workouts
        const exportWorkouts: ExportWorkout[] = workoutsList.map(workout => {
            const exercises: ExportExercise[] = workout.items
                .sort((a, b) => a.order - b.order)
                .map(item => {
                    const peId = toStringId(item.planExerciseId);
                    const peData = planExerciseMap.get(peId);
                    
                    if (!peData) {
                        // Exercise was deleted, skip it
                        return null;
                    }

                    const exercise: ExportExercise = {
                        name: peData.name,
                        exerciseDefId: peData.exerciseDefId,
                    };

                    // Only include non-default values
                    if (peData.sets > 0) exercise.sets = peData.sets;
                    if (peData.reps > 0) exercise.reps = peData.reps;
                    if (peData.weight > 0) exercise.weightKg = peData.weight;
                    if (peData.durationSeconds > 0) exercise.durationSeconds = peData.durationSeconds;
                    if (peData.comments) exercise.notes = peData.comments;

                    return exercise;
                })
                .filter((e): e is ExportExercise => e !== null);

            return {
                name: workout.name,
                exercises,
            };
        });

        // Filter out empty workouts
        const nonEmptyWorkouts = exportWorkouts.filter(w => w.exercises.length > 0);

        // Build export data
        const exportData: PlanExportData = {
            version: EXPORT_VERSION,
            planName: plan.name,
            durationWeeks: plan.durationWeeks,
            workouts: nonEmptyWorkouts,
        };

        return { exportData };

    } catch (error) {
        console.error('Export plan error:', error);
        return {
            error: 'Failed to export plan. Please try again.',
            errorCode: 'SERVER_ERROR',
        };
    }
}
