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
    sessionSource: null,
    autoStartTimer: true,
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
            sessionSource: state.sessionSource,
            autoStartTimer: state.autoStartTimer,
            // Don't persist restTimerEndAt as it's timestamp-based
        }),
    },
    creator: (set) => ({
        ...initialSessionState,

        startSession: (exercises: ExerciseWeekProgress[], source: 'plan' | 'saved-workout' = 'plan') => {
            set({
                isActive: true,
                startedAt: Date.now(),
                currentExerciseIndex: 0,
                exercises,
                restTimerEndAt: null,
                completedSetsThisSession: 0,
                sessionSource: source,
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
export const useSessionSource = () => useWorkoutSessionStore((state) => state.sessionSource);

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


