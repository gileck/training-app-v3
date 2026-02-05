import { Button } from '@/client/components/template/ui/button';
import { ChevronLeft, ChevronRight, Dumbbell } from 'lucide-react';
import type { ExerciseWeekProgress } from '@/apis/project/weekly-progress/types';

interface ExerciseCardProps {
    currentExercise: ExerciseWeekProgress;
    currentExerciseIndex: number;
    totalExercises: number;
    isInSet: boolean;
    isRestTimerRunning: boolean;
    isExerciseComplete: boolean;
    onPreviousExercise: () => void;
    onNextExercise: () => void;
    onStartSet: () => void;
    onCompleteSet: () => void;
    onAddSet: () => void;
    onRemoveSet: () => void;
}

export function ExerciseCard({
    currentExercise,
    currentExerciseIndex,
    totalExercises,
    isInSet,
    isRestTimerRunning,
    isExerciseComplete,
    onPreviousExercise,
    onNextExercise,
    onStartSet,
    onCompleteSet,
    onAddSet,
    onRemoveSet,
}: ExerciseCardProps) {
    return (
        <>
            {/* Internal nav arrows - vertically centered, anchored */}
            <div className="pointer-events-none">
                <button
                    onClick={onPreviousExercise}
                    disabled={currentExerciseIndex <= 0 || isInSet}
                    className="pointer-events-auto absolute left-3 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-muted/25 text-muted-foreground/70 ring-1 ring-border/30 hover:bg-muted/45 hover:text-foreground/80 transition-all duration-200 active:scale-90 disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                    onClick={onNextExercise}
                    disabled={currentExerciseIndex >= totalExercises - 1 || isInSet}
                    className="pointer-events-auto absolute right-3 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-muted/25 text-muted-foreground/70 ring-1 ring-border/30 hover:bg-muted/45 hover:text-foreground/80 transition-all duration-200 active:scale-90 disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center"
                >
                    <ChevronRight className="h-5 w-5" />
                </button>
            </div>

            <div className="flex flex-col items-center px-6 py-5">
                {/* Exercise Image - grounded with shadow */}
                <div className="relative mb-4">
                    <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 shadow-md ring-1 ring-border/25">
                        {currentExercise.exerciseDef.imageUrl ? (
                            <img
                                src={currentExercise.exerciseDef.imageUrl}
                                alt=""
                                className="w-full h-full object-contain bg-muted/30"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted">
                                <Dumbbell className="h-7 w-7 text-muted-foreground" />
                            </div>
                        )}
                    </div>
                    {/* Ground shadow */}
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-14 h-2.5 bg-foreground/10 rounded-full blur-md" />
                </div>

                {/* Exercise Name - heaviest weight */}
                <h2 className="text-xl font-extrabold text-center text-foreground">
                    {currentExercise.exerciseDef.name}
                </h2>

                {/* Reps · Weight - increased contrast */}
                <p className="text-sm mt-1 font-medium text-muted-foreground/80">
                    {currentExercise.planExercise.reps} reps
                    {currentExercise.planExercise.weight > 0 && ` · ${currentExercise.planExercise.weight}kg`}
                </p>

                {/* Set Dots - state-aware: IN SET quiets glow, confirms don't celebrate */}
                <div className="flex items-center justify-center gap-2.5 mt-4">
                    {Array.from({ length: currentExercise.targetSets }).map((_, i) => {
                        const isCompleted = i < currentExercise.setsCompleted;
                        const isCurrent = i === currentExercise.setsCompleted;
                        return (
                            <div
                                key={i}
                                className={`rounded-full transition-all duration-200 ${
                                    isCompleted
                                        ? 'w-4 h-4 bg-success'
                                        : isCurrent
                                            ? isInSet
                                                ? 'w-4 h-4 bg-success ring-2 ring-success/25'
                                                : 'w-3.5 h-3.5 bg-transparent ring-[1.5px] ring-success/[0.7]'
                                            : isInSet
                                                ? 'w-3 h-3 bg-muted-foreground/[0.2]'
                                                : 'w-3 h-3 bg-muted-foreground/[0.45]'
                                }`}
                            />
                        );
                    })}
                </div>

                {/* Numbers (secondary) */}
                <p className="text-[11px] mt-1.5 font-medium text-muted-foreground/60">
                    {currentExercise.setsCompleted} of {currentExercise.targetSets}
                </p>
            </div>

            {/* CTA Area - state-aware styling */}
            <div className="px-6 pb-5 pt-1">
                <div className="flex items-center justify-center gap-3">
                    {/* Remove Set - max 40% opacity, hidden in IN SET */}
                    <button
                        onClick={onRemoveSet}
                        disabled={currentExercise.setsCompleted <= 0}
                        className={`h-9 w-9 rounded-full border border-border/40 bg-muted/20 hover:bg-muted/60 hover:border-border flex items-center justify-center transition-all duration-200 active:scale-90 disabled:opacity-15 disabled:cursor-not-allowed ${
                            isInSet ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-35 hover:opacity-90'
                        }`}
                    >
                        <span className="text-base font-medium text-muted-foreground">−</span>
                    </button>

                    {/* Primary CTA - hierarchy: READY > REST, IN SET highest */}
                    {isExerciseComplete ? (
                        <Button
                            onClick={onNextExercise}
                            disabled={currentExerciseIndex >= totalExercises - 1}
                            className="h-11 px-6 rounded-xl text-sm font-semibold flex-1 max-w-[180px] bg-info hover:bg-info/90 text-info-foreground shadow-md shadow-info/30 active:scale-[0.97] transition-all duration-200"
                        >
                            Next Exercise
                        </Button>
                    ) : isInSet ? (
                        <Button
                            onClick={onCompleteSet}
                            className="h-12 px-8 rounded-xl text-sm font-bold flex-1 max-w-[200px] bg-success/90 hover:bg-success/90 text-success-foreground shadow-lg transition-none cursor-pointer active:scale-[0.995]"
                        >
                            Complete Set
                        </Button>
                    ) : isRestTimerRunning ? (
                        <Button
                            onClick={onStartSet}
                            className="h-10 px-5 rounded-xl text-sm font-medium flex-1 max-w-[160px] bg-info/75 hover:bg-info/90 text-info-foreground shadow-none active:scale-[0.97] transition-all duration-200"
                        >
                            Start Set
                        </Button>
                    ) : (
                        <Button
                            onClick={onStartSet}
                            className="h-11 px-7 rounded-xl text-sm font-bold flex-1 max-w-[180px] bg-info hover:bg-info/90 text-info-foreground shadow-lg shadow-info/40 active:scale-[0.97] transition-all duration-200"
                        >
                            Start Set
                        </Button>
                    )}

                    {/* Add Set - max 40% opacity, hidden in IN SET */}
                    <button
                        onClick={onAddSet}
                        disabled={isExerciseComplete}
                        className={`h-9 w-9 rounded-full border border-border/40 bg-muted/20 hover:bg-muted/60 hover:border-border flex items-center justify-center transition-all duration-200 active:scale-90 disabled:opacity-15 disabled:cursor-not-allowed ${
                            isInSet ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-35 hover:opacity-90'
                        }`}
                    >
                        <span className="text-base font-medium text-muted-foreground">+</span>
                    </button>
                </div>
            </div>
        </>
    );
}
