import type { ExerciseWeekProgress } from '@/apis/weekly-progress/types';
import { ExerciseCard } from './ExerciseCard';
import { SupersetCard } from './SupersetCard';

interface WorkoutCardContainerProps {
    currentExercise: ExerciseWeekProgress;
    currentExerciseIndex: number;
    sessionExercisesLength: number;
    isInSet: boolean;
    isRestTimerRunning: boolean;
    isExerciseComplete: boolean;
    supersetEnabled: boolean;
    supersetExercises: ExerciseWeekProgress[];
    supersetComplete: boolean;
    onPreviousExercise: () => void;
    onNextExercise: () => void;
    onStartSet: () => void;
    onCompleteSet: () => void;
    onAddSet: (exercise: ExerciseWeekProgress) => void;
    onRemoveSet: (exercise: ExerciseWeekProgress) => void;
    onOpenSupersetDialog: () => void;
}

export function WorkoutCardContainer({
    currentExercise,
    currentExerciseIndex,
    sessionExercisesLength,
    isInSet,
    isRestTimerRunning,
    isExerciseComplete,
    supersetEnabled,
    supersetExercises,
    supersetComplete,
    onPreviousExercise,
    onNextExercise,
    onStartSet,
    onCompleteSet,
    onAddSet,
    onRemoveSet,
    onOpenSupersetDialog,
}: WorkoutCardContainerProps) {
    return (
        <div className="flex-1 px-1 pt-1 pb-3 flex justify-center">
            <div className={`relative ${supersetEnabled && supersetExercises.length === 2 ? 'w-full max-w-3xl' : 'w-[360px] max-w-full'} rounded-xl overflow-hidden bg-card border border-border/40 transition-all duration-200 ease-out ${
                isInSet
                    ? 'shadow-2xl scale-[1.02] -translate-y-2'
                    : isRestTimerRunning
                        ? 'shadow-sm dark:shadow-md'
                        : 'shadow-md dark:shadow-lg'
            }`}>
                <div className={`relative h-2 transition-all duration-200 ${
                    isInSet
                        ? 'bg-success/70'
                        : isRestTimerRunning
                            ? 'bg-info/30'
                            : 'bg-muted-foreground/15'
                }`} />

                {supersetEnabled && supersetExercises.length === 2 ? (
                    <SupersetCard
                        supersetExercises={supersetExercises}
                        isInSet={isInSet}
                        supersetComplete={supersetComplete}
                        onOpenSupersetDialog={onOpenSupersetDialog}
                        onStartSet={onStartSet}
                        onCompleteSet={onCompleteSet}
                    />
                ) : (
                    <ExerciseCard
                        currentExercise={currentExercise}
                        currentExerciseIndex={currentExerciseIndex}
                        totalExercises={sessionExercisesLength}
                        isInSet={isInSet}
                        isRestTimerRunning={isRestTimerRunning}
                        isExerciseComplete={isExerciseComplete}
                        onPreviousExercise={onPreviousExercise}
                        onNextExercise={onNextExercise}
                        onStartSet={onStartSet}
                        onCompleteSet={onCompleteSet}
                        onAddSet={() => onAddSet(currentExercise)}
                        onRemoveSet={() => onRemoveSet(currentExercise)}
                    />
                )}
            </div>
        </div>
    );
}
