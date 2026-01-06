import { Card, CardContent } from '@/client/components/ui/card';
import { Button } from '@/client/components/ui/button';
import { Badge } from '@/client/components/ui/badge';
import {
    Plus,
    Minus,
    CheckCheck,
    Check,
    Info,
    Dumbbell,
} from 'lucide-react';
import type { ExerciseWeekProgressFromStore } from '@/client/features/plan-data';

export interface ExerciseCardProps {
    exercise: ExerciseWeekProgressFromStore;
    onAddSet: () => void;
    onRemoveSet: () => void;
    onCompleteAll: () => void;
    onOpenDetails: () => void;
    isComplete?: boolean;
    isSelected?: boolean;
    onSelect?: () => void;
}

export function ExerciseCardGrid({
    exercise,
    onAddSet,
    onRemoveSet,
    onCompleteAll,
    onOpenDetails,
    isComplete,
    isSelected,
    onSelect,
}: ExerciseCardProps) {
    const progress = (exercise.setsCompleted / exercise.targetSets) * 100;

    const handleCardClick = (e: React.MouseEvent) => {
        // Only trigger selection if clicking the card background, not buttons
        if ((e.target as HTMLElement).closest('button')) return;
        onSelect?.();
    };

    return (
        <Card
            onClick={handleCardClick}
            className={`rounded-2xl border-0 shadow-sm transition-all cursor-pointer active:scale-[0.98] ${isComplete ? 'border-2 border-success/50 bg-success/5' : ''
                } ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''}`}
        >
            <CardContent className="p-4">
                <div className="flex gap-4 mb-3">
                    {/* Image with completion/selection badge */}
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
                        {/* Selection badge (takes priority over completion badge) */}
                        {isSelected && (
                            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-sm">
                                <Check className="h-4 w-4 text-primary-foreground" strokeWidth={3} />
                            </div>
                        )}
                        {/* Completion badge (only shows if not selected) */}
                        {isComplete && !isSelected && (
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
                        className="bg-[hsl(210,100%,95%)] text-[hsl(210,100%,40%)] border-[hsl(210,100%,85%)] dark:bg-[hsl(210,100%,20%)] dark:text-[hsl(210,100%,80%)]"
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

export function ExerciseCardList({
    exercise,
    onAddSet,
    onRemoveSet,
    onCompleteAll,
    onOpenDetails,
    isComplete,
    isSelected,
    onSelect,
}: ExerciseCardProps) {
    const progress = (exercise.setsCompleted / exercise.targetSets) * 100;

    const handleCardClick = (e: React.MouseEvent) => {
        // Only trigger selection if clicking the card background, not buttons
        if ((e.target as HTMLElement).closest('button')) return;
        onSelect?.();
    };

    return (
        <Card
            onClick={handleCardClick}
            className={`rounded-xl border-0 shadow-sm transition-all cursor-pointer active:scale-[0.98] ${isComplete ? 'border-2 border-success/50 bg-success/5' : ''
                } ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''}`}
        >
            <CardContent className="p-3">
                <div className="flex items-center gap-3">
                    {/* Image with completion/selection badge - clickable to open details */}
                    <div className="relative flex-shrink-0">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpenDetails();
                            }}
                            className="w-12 h-12 rounded-lg bg-muted overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                        >
                            {exercise.exerciseDef.imageUrl ? (
                                <img
                                    src={exercise.exerciseDef.imageUrl}
                                    alt={exercise.exerciseDef.name}
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Dumbbell className="h-5 w-5 text-muted-foreground" />
                                </div>
                            )}
                        </button>
                        {/* Selection badge (takes priority) */}
                        {isSelected && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-sm">
                                <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
                            </div>
                        )}
                        {/* Completion badge (only if not selected) */}
                        {isComplete && !isSelected && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-success flex items-center justify-center shadow-sm">
                                <Check className="h-3 w-3 text-success-foreground" strokeWidth={3} />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{exercise.exerciseDef.name}</h3>
                        <p className={`text-sm ${isComplete ? 'text-success' : 'text-muted-foreground'}`}>
                            {exercise.setsCompleted}/{exercise.targetSets} sets{isComplete && ' ✓'}
                        </p>
                    </div>
                    <div className="flex gap-1">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={onRemoveSet}
                            disabled={exercise.setsCompleted <= 0}
                            className={`h-9 w-9 rounded-full active:scale-95 transition-transform ${
                                isComplete ? 'text-destructive border-destructive/50 hover:bg-destructive/10' : ''
                            }`}
                        >
                            <Minus className="h-4 w-4" />
                        </Button>
                        <Button
                            size="icon"
                            onClick={onAddSet}
                            disabled={exercise.setsCompleted >= exercise.targetSets}
                            className="h-9 w-9 rounded-full active:scale-95 transition-transform"
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                        {!isComplete && (
                            <Button
                                size="icon"
                                onClick={onCompleteAll}
                                className="h-9 w-9 rounded-full bg-success hover:bg-success/90 active:scale-95 transition-transform"
                            >
                                <CheckCheck className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                    <div
                        className={`h-full rounded-full transition-all duration-300 ${isComplete
                                ? 'bg-success'
                                : 'bg-gradient-to-r from-primary to-primary/80'
                            }`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
