import { Button } from '@/client/components/template/ui/button';
import { Dumbbell } from 'lucide-react';
import type { ExerciseWeekProgress } from '@/apis/project/weekly-progress/types';

interface SupersetCardProps {
    supersetExercises: ExerciseWeekProgress[];
    isInSet: boolean;
    supersetComplete: boolean;
    onOpenSupersetDialog: () => void;
    onStartSet: () => void;
    onCompleteSet: () => void;
}

export function SupersetCard({
    supersetExercises,
    isInSet,
    supersetComplete,
    onOpenSupersetDialog,
    onStartSet,
    onCompleteSet,
}: SupersetCardProps) {
    return (
        <div className="px-6 py-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-foreground">Super set</div>
                <Button variant="outline" size="sm" onClick={onOpenSupersetDialog}>
                    Choose exercises
                </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {supersetExercises.map((exercise, idx) => {
                    const isCompleted = exercise.setsCompleted >= exercise.targetSets;
                    return (
                        <div key={exercise.planExerciseId} className="rounded-lg border border-border/50 p-4 shadow-sm bg-card/80">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex items-center justify-center ring-1 ring-border/40">
                                    {exercise.exerciseDef.imageUrl ? (
                                        <img
                                            src={exercise.exerciseDef.imageUrl}
                                            alt=""
                                            className="w-full h-full object-contain"
                                        />
                                    ) : (
                                        <Dumbbell className="h-6 w-6 text-muted-foreground" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold truncate">
                                        {idx === 0 ? 'A · ' : 'B · '}
                                        {exercise.exerciseDef.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {exercise.planExercise.reps} reps
                                        {exercise.planExercise.weight > 0 && ` · ${exercise.planExercise.weight}kg`}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between mt-3">
                                <div className="flex items-center gap-2">
                                    {Array.from({ length: exercise.targetSets }).map((_, i) => {
                                        const dotComplete = i < exercise.setsCompleted;
                                        return (
                                            <div
                                                key={i}
                                                className={`h-2.5 w-2.5 rounded-full transition-colors duration-200 ${
                                                    dotComplete ? 'bg-success' : 'bg-muted-foreground/30'
                                                }`}
                                            />
                                        );
                                    })}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    {exercise.setsCompleted}/{exercise.targetSets}
                                </span>
                            </div>
                            {isCompleted && (
                                <p className="mt-2 text-xs text-success font-medium">Done</p>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
                {isInSet ? (
                    <Button
                        onClick={onCompleteSet}
                        className="h-11 px-6 rounded-xl text-sm font-bold bg-success/90 hover:bg-success/90 text-success-foreground shadow-lg transition-none active:scale-[0.995]"
                    >
                        Complete Set (A & B)
                    </Button>
                ) : supersetComplete ? (
                    <Button
                        variant="outline"
                        className="h-11 px-6 rounded-xl text-sm font-semibold"
                        disabled
                    >
                        Superset complete
                    </Button>
                ) : (
                    <Button
                        onClick={onStartSet}
                        className="h-11 px-6 rounded-xl text-sm font-bold bg-info hover:bg-info/90 text-info-foreground shadow-lg shadow-info/40 active:scale-[0.97]"
                    >
                        Start Sets
                    </Button>
                )}
            </div>
        </div>
    );
}
