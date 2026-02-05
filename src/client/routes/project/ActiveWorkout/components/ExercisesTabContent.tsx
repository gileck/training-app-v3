import { Card, CardContent } from '@/client/components/template/ui/card';
import { Button } from '@/client/components/template/ui/button';
import { Badge } from '@/client/components/template/ui/badge';
import {
    Plus,
    Minus,
    CheckCheck,
    Check,
    Info,
    Dumbbell,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import { useState } from 'react';
import type { ExerciseWeekProgress } from '@/apis/project/weekly-progress/types';
import { TimerZone } from './TimerZone';

interface ExercisesTabContentProps {
    sessionExercises: ExerciseWeekProgress[];
    onAddSet: (exercise: ExerciseWeekProgress) => void;
    onRemoveSet: (exercise: ExerciseWeekProgress) => void;
    onCompleteAll: (exercise: ExerciseWeekProgress) => void;
    onOpenDetails: (exercise: ExerciseWeekProgress) => void;
    // Timer props
    isInSet: boolean;
    isRestTimerRunning: boolean;
    remainingSeconds: number;
    restTimerProgress: number;
    onStartRestTimer: (seconds: number) => void;
    onCancelRestTimer: () => void;
}

interface ExerciseCardProps {
    exercise: ExerciseWeekProgress;
    onAddSet: () => void;
    onRemoveSet: () => void;
    onCompleteAll: () => void;
    onOpenDetails: () => void;
    isComplete?: boolean;
}

function ExerciseCard({
    exercise,
    onAddSet,
    onRemoveSet,
    onCompleteAll,
    onOpenDetails,
    isComplete,
}: ExerciseCardProps) {
    const progress = (exercise.setsCompleted / exercise.targetSets) * 100;

    return (
        <Card
            className={`rounded-2xl border-0 shadow-sm transition-all ${isComplete ? 'border-2 border-success/50 bg-success/5' : ''}`}
        >
            <CardContent className="p-4">
                <div className="flex gap-4 mb-3">
                    {/* Image with completion badge */}
                    <div className="relative flex-shrink-0">
                        <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden">
                            {exercise.exerciseDef.imageUrl ? (
                                <img
                                    src={exercise.exerciseDef.imageUrl}
                                    alt={exercise.exerciseDef.name}
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Dumbbell className="h-8 w-8 text-muted-foreground" />
                                </div>
                            )}
                        </div>
                        {/* Completion badge */}
                        {isComplete && (
                            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-success flex items-center justify-center shadow-sm">
                                <Check className="h-4 w-4 text-success-foreground" strokeWidth={3} />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-lg truncate">{exercise.exerciseDef.name}</h3>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full text-primary"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenDetails();
                                }}
                            >
                                <Info className="h-4 w-4" />
                            </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {exercise.planExercise.reps} reps
                            {exercise.planExercise.weight > 0 && ` • ${exercise.planExercise.weight}kg`}
                        </p>
                        <p className={`text-base font-semibold mt-1 ${isComplete ? 'text-success' : ''}`}>
                            Sets: {exercise.setsCompleted}/{exercise.targetSets}
                            {isComplete && ' ✓'}
                        </p>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
                    <div
                        className={`h-full rounded-full transition-all duration-300 ${isComplete
                            ? 'bg-success'
                            : 'bg-gradient-to-r from-primary to-primary/80'
                            }`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <Badge
                        variant="outline"
                        className="bg-primary/10 text-primary border-primary/20"
                    >
                        {exercise.exerciseDef.primaryMuscle}
                    </Badge>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={onRemoveSet}
                            disabled={exercise.setsCompleted <= 0}
                            className="h-11 w-11 rounded-full border-2 active:scale-95 transition-transform"
                        >
                            <Minus className="h-5 w-5" />
                        </Button>
                        <Button
                            size="icon"
                            onClick={onAddSet}
                            disabled={exercise.setsCompleted >= exercise.targetSets}
                            className="h-11 w-11 rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25 active:scale-95 transition-transform"
                        >
                            <Plus className="h-6 w-6" />
                        </Button>
                        {!isComplete && (
                            <Button
                                size="icon"
                                onClick={onCompleteAll}
                                className="h-11 w-11 rounded-full bg-success shadow-lg shadow-success/30 active:scale-95 transition-transform"
                            >
                                <CheckCheck className="h-6 w-6" />
                            </Button>
                        )}
                        {isComplete && (
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-11 w-11 rounded-full text-success border-2 border-success/50 bg-success/10"
                                disabled
                            >
                                <CheckCheck className="h-5 w-5" />
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export function ExercisesTabContent({
    sessionExercises,
    onAddSet,
    onRemoveSet,
    onCompleteAll,
    onOpenDetails,
    isInSet,
    isRestTimerRunning,
    remainingSeconds,
    restTimerProgress,
    onStartRestTimer,
    onCancelRestTimer,
}: ExercisesTabContentProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state
    const [completedExpanded, setCompletedExpanded] = useState(false);

    const incompleteExercises = sessionExercises.filter((e) => e.setsCompleted < e.targetSets);
    const completedExercises = sessionExercises.filter((e) => e.setsCompleted >= e.targetSets);

    return (
        <div className="flex flex-col space-y-4">
            {/* No exercises */}
            {sessionExercises.length === 0 && (
                <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Dumbbell className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No exercises in this workout</h3>
                        <p className="text-sm text-muted-foreground text-center">
                            Add exercises from the All Exercises view
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Incomplete Exercises */}
            {incompleteExercises.length > 0 && (
                <div className="space-y-3">
                    {incompleteExercises.map((exercise) => (
                        <ExerciseCard
                            key={exercise.planExerciseId}
                            exercise={exercise}
                            onAddSet={() => onAddSet(exercise)}
                            onRemoveSet={() => onRemoveSet(exercise)}
                            onCompleteAll={() => onCompleteAll(exercise)}
                            onOpenDetails={() => onOpenDetails(exercise)}
                        />
                    ))}
                </div>
            )}

            {/* Completed Exercises Section */}
            {completedExercises.length > 0 && (
                <div className="space-y-3">
                    <button
                        onClick={() => setCompletedExpanded(!completedExpanded)}
                        className="flex items-center justify-between w-full py-2 text-left"
                    >
                        <span className="text-sm font-medium text-muted-foreground">
                            Completed Exercises ({completedExercises.length})
                        </span>
                        {completedExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                    </button>

                    {completedExpanded && (
                        <div className="space-y-3">
                            {completedExercises.map((exercise) => (
                                <ExerciseCard
                                    key={exercise.planExerciseId}
                                    exercise={exercise}
                                    onAddSet={() => onAddSet(exercise)}
                                    onRemoveSet={() => onRemoveSet(exercise)}
                                    onCompleteAll={() => {}}
                                    onOpenDetails={() => onOpenDetails(exercise)}
                                    isComplete
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Timer Zone at the bottom */}
            <div className="pt-4 border-t border-border/50">
                <TimerZone
                    isInSet={isInSet}
                    isRestTimerRunning={isRestTimerRunning}
                    remainingSeconds={remainingSeconds}
                    restTimerProgress={restTimerProgress}
                    onStartRestTimer={onStartRestTimer}
                    onCancelRestTimer={onCancelRestTimer}
                />
            </div>
        </div>
    );
}
