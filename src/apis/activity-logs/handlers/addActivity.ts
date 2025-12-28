import { ObjectId } from 'mongodb';
import { AddActivityRequest, AddActivityResponse, ActivityLogEntry } from '../types';
import { setLogs } from '@/server/database';
import * as planExercises from '@/server/database/collections/planExercises';
import * as exerciseDefinitions from '@/server/database/collections/exerciseDefinitions';
import * as trainingPlans from '@/server/database/collections/trainingPlans';
import type { ApiHandlerContext } from '@/apis/types';

export async function addActivity(
    request: AddActivityRequest,
    context: ApiHandlerContext
): Promise<AddActivityResponse> {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        if (!request.planExerciseId) {
            return { error: 'Plan exercise ID is required' };
        }

        if (!request.completedAt) {
            return { error: 'Completed at date is required' };
        }

        if (!request.numberOfSets || request.numberOfSets < 1) {
            return { error: 'Number of sets must be at least 1' };
        }

        if (request.numberOfSets > 20) {
            return { error: 'Number of sets cannot exceed 20' };
        }

        const completedAt = new Date(request.completedAt);
        if (isNaN(completedAt.getTime())) {
            return { error: 'Invalid date format' };
        }

        // Find the plan exercise to get plan info
        const planExercise = await planExercises.findPlanExerciseById(request.planExerciseId);
        if (!planExercise) {
            return { error: 'Plan exercise not found' };
        }

        // Verify the plan belongs to the user
        const plan = await trainingPlans.findPlanById(
            planExercise.planId.toHexString(),
            context.userId
        );
        if (!plan) {
            return { error: 'Plan not found or unauthorized' };
        }

        // Get exercise definition for response
        const exerciseDef = await exerciseDefinitions.findExerciseById(
            planExercise.exerciseDefId.toHexString()
        );
        const exerciseInfo = exerciseDef
            ? {
                  name: exerciseDef.name,
                  imageUrl: exerciseDef.imageUrl,
                  primaryMuscle: exerciseDef.primaryMuscle,
              }
            : { name: 'Unknown Exercise', imageUrl: '', primaryMuscle: '' };

        // Create set logs for each set
        const activities: ActivityLogEntry[] = [];
        const userIdObj = new ObjectId(context.userId);

        for (let setNumber = 1; setNumber <= request.numberOfSets; setNumber++) {
            const newSetLog = await setLogs.createSetLog({
                userId: userIdObj,
                planExerciseId: planExercise._id,
                planId: planExercise.planId,
                weekNumber: 1, // Default to week 1 for manually added logs
                setNumber,
                completedAt,
            });

            activities.push({
                _id: newSetLog._id.toHexString(),
                userId: newSetLog.userId.toHexString(),
                planExerciseId: newSetLog.planExerciseId.toHexString(),
                planId: newSetLog.planId.toHexString(),
                weekNumber: newSetLog.weekNumber,
                setNumber: newSetLog.setNumber,
                completedAt: newSetLog.completedAt.toISOString(),
                exerciseName: exerciseInfo.name,
                exerciseImageUrl: exerciseInfo.imageUrl,
                primaryMuscle: exerciseInfo.primaryMuscle,
                planName: plan.name,
            });
        }

        return { activities };
    } catch (error) {
        console.error('Error adding activity:', error);
        return { error: 'Failed to add activity' };
    }
}
