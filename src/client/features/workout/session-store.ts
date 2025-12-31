import { createStore } from '@/client/stores';
import type { WorkoutSessionState, WorkoutSession } from './session-types';
import type { ExerciseWeekProgress } from '@/apis/weekly-progress/types';

const initialSessionState: WorkoutSession = {
    isActive: false,
    startedAt: null,
    currentExerciseIndex: 0,
    exercises: [],
    restTimerEndAt: null,
    restTimerDuration: 90,
    completedSetsThisSession: 0,
    autoStartTimer: true,
    planWorkoutId: null,
    planWorkoutName: null,
    isInSet: false,
    supersetEnabled: false,
    supersetExerciseIds: [],
};

export const useWorkoutSessionStore = createStore<WorkoutSessionState>({
    key: 'workout-session',
    label: 'Workout Session',
    persistOptions: {
        // Persist session state to localStorage so it survives page refreshes
        partialize: (state) => ({
            isActive: state.isActive,
            startedAt: state.startedAt,
            currentExerciseIndex: state.currentExerciseIndex,
            exercises: state.exercises,
            restTimerDuration: state.restTimerDuration,
            completedSetsThisSession: state.completedSetsThisSession,
            autoStartTimer: state.autoStartTimer,
            planWorkoutId: state.planWorkoutId,
            planWorkoutName: state.planWorkoutName,
            isInSet: state.isInSet,
            supersetEnabled: state.supersetEnabled,
            supersetExerciseIds: state.supersetExerciseIds,
            // Don't persist restTimerEndAt as it's timestamp-based
        }),
    },
    creator: (set) => ({
        ...initialSessionState,

        startSession: (exercises: ExerciseWeekProgress[]) => {
            set({
                isActive: true,
                startedAt: Date.now(),
                currentExerciseIndex: 0,
                exercises,
                restTimerEndAt: null,
                completedSetsThisSession: 0,
                // planWorkoutId and planWorkoutName are set separately after startSession
            });
        },

        endSession: () => {
            set(initialSessionState);
        },

        setCurrentExercise: (index: number) => {
            set((state) => ({
                currentExerciseIndex: Math.max(0, Math.min(index, state.exercises.length - 1)),
            }));
        },

        startRestTimer: (durationSeconds?: number) => {
            set((state) => {
                const duration = durationSeconds ?? state.restTimerDuration;
                return {
                    restTimerDuration: duration,
                    restTimerEndAt: Date.now() + duration * 1000,
                };
            });
        },

        setRestTimerDuration: (durationSeconds: number) => {
            const duration = Math.max(5, Math.round(durationSeconds));
            set({ restTimerDuration: duration });
        },

        cancelRestTimer: () => {
            set({ restTimerEndAt: null });
        },

        incrementCompletedSets: () => {
            set((state) => ({
                completedSetsThisSession: state.completedSetsThisSession + 1,
            }));
        },

        updateExercises: (exercises: ExerciseWeekProgress[]) => {
            set({ exercises });
        },

        toggleAutoStartTimer: () => {
            set((state) => ({ autoStartTimer: !state.autoStartTimer }));
        },

        setPlanWorkoutId: (id: string | null) => {
            set({ planWorkoutId: id });
        },

        setPlanWorkoutName: (name: string | null) => {
            set({ planWorkoutName: name });
        },

        setIsInSet: (isInSet: boolean) => {
            set({ isInSet });
        },

        setSupersetEnabled: (enabled: boolean) => {
            set((state) => ({
                supersetEnabled: enabled,
                supersetExerciseIds: enabled ? state.supersetExerciseIds.slice(0, 2) : [],
            }));
        },

        setSupersetExerciseIds: (exerciseIds: string[]) => {
            set({
                supersetExerciseIds: exerciseIds.slice(0, 2),
                supersetEnabled: exerciseIds.length >= 2,
            });
        },
    }),
});

// Selector hooks
export const useIsSessionActive = () => useWorkoutSessionStore((state) => state.isActive);
export const useSessionExercises = () => useWorkoutSessionStore((state) => state.exercises);
export const useCurrentExerciseIndex = () => useWorkoutSessionStore((state) => state.currentExerciseIndex);
export const useRestTimerEndAt = () => useWorkoutSessionStore((state) => state.restTimerEndAt);
export const useRestTimerDuration = () => useWorkoutSessionStore((state) => state.restTimerDuration);
export const useCompletedSetsThisSession = () => useWorkoutSessionStore((state) => state.completedSetsThisSession);
export const useSessionStartedAt = () => useWorkoutSessionStore((state) => state.startedAt);
export const usePlanWorkoutId = () => useWorkoutSessionStore((state) => state.planWorkoutId);
export const usePlanWorkoutName = () => useWorkoutSessionStore((state) => state.planWorkoutName);

// Get current exercise
export const useCurrentExercise = () => {
    const exercises = useSessionExercises();
    const index = useCurrentExerciseIndex();
    return exercises[index] ?? null;
};

// Session actions
export const useStartSession = () => useWorkoutSessionStore((state) => state.startSession);
export const useEndSession = () => useWorkoutSessionStore((state) => state.endSession);
export const useSetCurrentExercise = () => useWorkoutSessionStore((state) => state.setCurrentExercise);
export const useStartRestTimer = () => useWorkoutSessionStore((state) => state.startRestTimer);
export const useCancelRestTimer = () => useWorkoutSessionStore((state) => state.cancelRestTimer);
export const useIncrementCompletedSets = () => useWorkoutSessionStore((state) => state.incrementCompletedSets);
export const useUpdateSessionExercises = () => useWorkoutSessionStore((state) => state.updateExercises);
export const useToggleAutoStartTimer = () => useWorkoutSessionStore((state) => state.toggleAutoStartTimer);
export const useAutoStartTimer = () => useWorkoutSessionStore((state) => state.autoStartTimer);
export const useSetPlanWorkoutId = () => useWorkoutSessionStore((state) => state.setPlanWorkoutId);
export const useSetPlanWorkoutName = () => useWorkoutSessionStore((state) => state.setPlanWorkoutName);
export const useIsInSet = () => useWorkoutSessionStore((state) => state.isInSet);
export const useSetIsInSet = () => useWorkoutSessionStore((state) => state.setIsInSet);
export const useSetRestTimerDuration = () => useWorkoutSessionStore((state) => state.setRestTimerDuration);
export const useSupersetEnabled = () => useWorkoutSessionStore((state) => state.supersetEnabled);
export const useSupersetExerciseIds = () => useWorkoutSessionStore((state) => state.supersetExerciseIds);
export const useSetSupersetEnabled = () => useWorkoutSessionStore((state) => state.setSupersetEnabled);
export const useSetSupersetExerciseIds = () => useWorkoutSessionStore((state) => state.setSupersetExerciseIds);


