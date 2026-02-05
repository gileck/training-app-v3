import type { ExerciseWeekProgress } from '@/apis/project/weekly-progress/types';
import type { GetWeekProgressResponse } from '@/apis/project/weekly-progress/types';
import { AllExercisesOverlay } from './AllExercisesOverlay';

interface AllExercisesViewProps {
    sessionExercises: ExerciseWeekProgress[];
    currentExerciseIndex: number;
    supersetEnabled: boolean;
    supersetExerciseIds: string[];
    activePlanId: string | null;
    planWorkoutId: string | null;
    weekProgressData: GetWeekProgressResponse | undefined;
    setCurrentExerciseAction: (index: number) => void;
    updateSessionExercises: (exercises: ExerciseWeekProgress[]) => void;
    setSupersetEnabled: (enabled: boolean) => void;
    setSupersetExerciseIds: (ids: string[]) => void;
    setAllExercisesOpen: (open: boolean) => void;
}

export function AllExercisesView({
    sessionExercises,
    currentExerciseIndex,
    supersetEnabled,
    supersetExerciseIds,
    activePlanId,
    planWorkoutId,
    weekProgressData,
    setCurrentExerciseAction,
    updateSessionExercises,
    setSupersetEnabled,
    setSupersetExerciseIds,
    setAllExercisesOpen,
}: AllExercisesViewProps) {
    const planWeekExercises = weekProgressData?.exercises || [];
    const canAddFromPlan = !!activePlanId && planWeekExercises.length > 0;
    const isSavedWorkout = planWorkoutId !== null;

    const handleReorderExercises = (nextExercises: ExerciseWeekProgress[]) => {
        const currentId = sessionExercises[currentExerciseIndex]?.planExerciseId;
        updateSessionExercises(nextExercises);
        if (!currentId) return;
        const nextIndex = nextExercises.findIndex((ex) => ex.planExerciseId === currentId);
        if (nextIndex >= 0 && nextIndex !== currentExerciseIndex) {
            setCurrentExerciseAction(nextIndex);
        }
    };

    const handleRemoveExercise = (planExerciseId: string) => {
        const currentId = sessionExercises[currentExerciseIndex]?.planExerciseId;
        const nextExercises = sessionExercises.filter((ex) => ex.planExerciseId !== planExerciseId);
        updateSessionExercises(nextExercises);

        if (supersetEnabled && supersetExerciseIds.includes(planExerciseId)) {
            setSupersetEnabled(false);
            setSupersetExerciseIds([]);
        }

        if (nextExercises.length === 0) return;

        if (currentId && currentId !== planExerciseId) {
            const nextIndex = nextExercises.findIndex((ex) => ex.planExerciseId === currentId);
            if (nextIndex >= 0 && nextIndex !== currentExerciseIndex) {
                setCurrentExerciseAction(nextIndex);
            }
            return;
        }

        const clamped = Math.min(currentExerciseIndex, nextExercises.length - 1);
        setCurrentExerciseAction(clamped);
    };

    return (
        <AllExercisesOverlay
            exercises={sessionExercises}
            currentIndex={currentExerciseIndex}
            onSelectExercise={(index) => {
                setCurrentExerciseAction(index);
                setAllExercisesOpen(false);
            }}
            onReorderExercises={handleReorderExercises}
            onRemoveExercise={handleRemoveExercise}
            canAddFromPlan={canAddFromPlan}
            planWeekExercises={planWeekExercises}
            isSavedWorkout={isSavedWorkout}
            onAddExercise={(exercise) => {
                if (sessionExercises.some((ex) => ex.planExerciseId === exercise.planExerciseId)) return;
                updateSessionExercises([...sessionExercises, exercise]);
            }}
            onBack={() => setAllExercisesOpen(false)}
        />
    );
}
