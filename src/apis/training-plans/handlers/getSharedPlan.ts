/**
 * Get Shared Plan Handler (PUBLIC API - no auth required)
 * 
 * Decodes a share token to get userId + planId, fetches the plan,
 * and returns it in export format for preview.
 * 
 * Token format: base64url(JSON.stringify({ u: userId, p: planId }))
 */

import type { 
    GetSharedPlanRequest, 
    GetSharedPlanResponse,
    PlanExportData,
    ExportWorkout,
    ExportExercise,
} from '../types';
import { trainingPlans, planExercises, exerciseDefinitions, planWorkouts, users } from '@/server/database';
import { toStringId } from '@/server/utils';

const EXPORT_VERSION = '1.0';

interface ShareTokenPayload {
    u: string;  // userId
    p: string;  // planId
}

/**
 * Decode base64url token to get userId and planId
 */
function decodeShareToken(token: string): ShareTokenPayload | null {
    try {
        // Convert base64url to base64
        const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
        // Add padding if needed
        const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
        // Decode
        const json = Buffer.from(padded, 'base64').toString('utf-8');
        const payload = JSON.parse(json) as ShareTokenPayload;
        
        // Validate payload structure
        if (typeof payload.u !== 'string' || typeof payload.p !== 'string') {
            return null;
        }
        
        return payload;
    } catch {
        return null;
    }
}

export async function getSharedPlan(
    request: GetSharedPlanRequest
): Promise<GetSharedPlanResponse> {
    try {
        // Validate request
        if (!request.token) {
            return {
                error: 'Share token is required',
                errorCode: 'INVALID_TOKEN',
            };
        }

        // Decode token
        const payload = decodeShareToken(request.token);
        if (!payload) {
            return {
                error: 'Invalid share link. The link may be corrupted or expired.',
                errorCode: 'INVALID_TOKEN',
            };
        }

        const { u: userId, p: planId } = payload;

        // Fetch the plan (using userId from token, not from auth context)
        const plan = await trainingPlans.findPlanById(planId, userId);
        if (!plan) {
            return {
                error: 'This plan no longer exists. It may have been deleted.',
                errorCode: 'PLAN_NOT_FOUND',
            };
        }

        // Fetch owner's username for display
        let ownerName: string | undefined;
        try {
            const owner = await users.findUserById(userId);
            if (owner) {
                ownerName = owner.username || owner.email?.split('@')[0];
            }
        } catch {
            // Owner name is optional, don't fail if we can't get it
        }

        // Fetch all plan exercises
        const planExercisesList = await planExercises.findExercisesByPlanId(planId);

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
        const workoutsList = await planWorkouts.listPlanWorkouts(userId, planId);

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

        return { 
            exportData,
            ownerName,
        };

    } catch (error) {
        console.error('Get shared plan error:', error);
        return {
            error: 'Failed to load shared plan. Please try again.',
            errorCode: 'SERVER_ERROR',
        };
    }
}
