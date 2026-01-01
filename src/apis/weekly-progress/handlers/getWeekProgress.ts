import {
    ApiHandlerContext,
    GetWeekProgressRequest,
    GetWeekProgressResponse,
    ExerciseWeekProgress,
} from '../types';
import {
    trainingPlans,
    planExercises,
    exerciseDefinitions,
    weeklyProgress,
    exerciseProgress,
} from '@/server/database';
import { toStringId } from '@/server/utils';

export const getWeekProgress = async (
    request: GetWeekProgressRequest,
    context: ApiHandlerContext
): Promise<GetWeekProgressResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        if (!request.planId) {
            return { error: 'Plan ID is required' };
        }

        if (!request.weekNumber || request.weekNumber < 1) {
            return { error: 'Week number must be at least 1' };
        }

        // Verify plan belongs to user
        const plan = await trainingPlans.findPlanById(request.planId, context.userId);
        if (!plan) {
            return { error: 'Plan not found' };
        }

        // Validate week number
        if (request.weekNumber > plan.durationWeeks) {
            return { error: 'Week number exceeds plan duration' };
        }

        // Get all exercises in the plan
        const exerciseList = await planExercises.findExercisesByPlanId(request.planId);

        if (exerciseList.length === 0) {
            return {
                weekNumber: request.weekNumber,
                totalSets: 0,
                completedSets: 0,
                progressPercent: 0,
                exercises: [],
            };
        }

        // Get or create weekly progress record
        const weekProgress = await weeklyProgress.findOrCreateWeeklyProgress(
            request.planId,
            request.weekNumber
        );

        // Get exercise definitions (handles both ObjectId and UUID)
        const exerciseDefIds = exerciseList.map((e) => e.exerciseDefId);
        const exerciseDefs = await exerciseDefinitions.findExercisesByIds(exerciseDefIds);
        const exerciseDefMap = new Map(exerciseDefs.map((def) => [toStringId(def._id), def]));

        // Get all exercise progress for this week
        const allProgress = await exerciseProgress.findExerciseProgressByWeekId(toStringId(weekProgress._id));
        const progressMap = new Map(allProgress.map((p) => [toStringId(p.planExerciseId), p]));

        // Calculate totals and build response
        let totalSets = 0;
        let completedSets = 0;

        const exercises: ExerciseWeekProgress[] = [];
        for (const exercise of exerciseList) {
            const def = exerciseDefMap.get(toStringId(exercise.exerciseDefId));
            if (!def) continue;

            const progress = progressMap.get(toStringId(exercise._id));
            const setsCompleted = progress?.setsCompleted || 0;
            const isDone = progress?.isDone || setsCompleted >= exercise.sets;

            totalSets += exercise.sets;
            completedSets += Math.min(setsCompleted, exercise.sets);

            exercises.push({
                planExerciseId: toStringId(exercise._id),
                targetSets: exercise.sets,
                setsCompleted,
                isDone,
                exerciseDef: {
                    _id: toStringId(def._id),
                    name: def.name,
                    imageUrl: def.imageUrl,
                    primaryMuscle: def.primaryMuscle,
                    secondaryMuscles: def.secondaryMuscles,
                    type: def.type,
                    isBodyweight: def.isBodyweight,
                    isStatic: def.isStatic,
                    isSystem: def.isSystem,
                    userId: def.userId ? toStringId(def.userId) : undefined,
                    createdAt: def.createdAt.toISOString(),
                    updatedAt: def.updatedAt.toISOString(),
                },
                planExercise: {
                    _id: toStringId(exercise._id),
                    planId: toStringId(exercise.planId),
                    exerciseDefId: toStringId(exercise.exerciseDefId),
                    sets: exercise.sets,
                    reps: exercise.reps,
                    weight: exercise.weight,
                    durationSeconds: exercise.durationSeconds,
                    comments: exercise.comments,
                    order: exercise.order,
                    createdAt: exercise.createdAt.toISOString(),
                    updatedAt: exercise.updatedAt.toISOString(),
                },
            });
        }

        const progressPercent = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

        return {
            weekNumber: request.weekNumber,
            totalSets,
            completedSets,
            progressPercent,
            exercises,
        };
    } catch (error: unknown) {
        console.error('Get week progress error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to get week progress' };
    }
};

