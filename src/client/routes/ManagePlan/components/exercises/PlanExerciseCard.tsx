import Image from 'next/image';
import { Button } from '@/client/components/ui/button';
import { Card, CardContent } from '@/client/components/ui/card';
import { Badge } from '@/client/components/ui/badge';
import { ChevronUp, ChevronDown, Trash2, Dumbbell, Settings2 } from 'lucide-react';
import type { PlanExerciseWithDefinition } from '@/apis/plan-exercises/types';
import { getEffectiveExerciseValues, hasOverrides } from '../../utils/exerciseOverrides';

interface PlanExerciseCardProps {
    exercise: PlanExerciseWithDefinition;
    index: number;
    isFirst: boolean;
    isLast: boolean;
    isReorderMode: boolean;
    isReorderPending: boolean;
    onEdit: () => void;
    onDelete: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
}

export function PlanExerciseCard({
    exercise,
    isFirst,
    isLast,
    isReorderMode,
    isReorderPending,
    onEdit,
    onDelete,
    onMoveUp,
    onMoveDown,
}: PlanExerciseCardProps) {
    // Get effective values (original merged with overrides)
    const effectiveValues = getEffectiveExerciseValues(exercise.exerciseDef, exercise.overrides);
    const isCustomized = hasOverrides(exercise);

    return (
        <Card
            className="rounded-xl border-0 shadow-sm active:scale-[0.98] transition-transform cursor-pointer hover:bg-muted/50"
            onClick={onEdit}
        >
            <CardContent className="p-3">
                <div className="flex items-center gap-3">
                    {/* Reorder buttons - only show in reorder mode */}
                    {isReorderMode && (
                        <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onMoveUp}
                                disabled={isFirst || isReorderPending}
                                className="h-7 w-7 rounded-md"
                            >
                                <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onMoveDown}
                                disabled={isLast || isReorderPending}
                                className="h-7 w-7 rounded-md"
                            >
                                <ChevronDown className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                    <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0 relative">
                        {effectiveValues.imageUrl ? (
                            <Image
                                src={effectiveValues.imageUrl}
                                alt={effectiveValues.name}
                                fill
                                className="object-contain"
                                unoptimized
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <Dumbbell className="h-6 w-6 text-muted-foreground" />
                            </div>
                        )}
                        {/* Customized indicator on image */}
                        {isCustomized && (
                            <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary/90 flex items-center justify-center">
                                <Settings2 className="h-3 w-3 text-primary-foreground" />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">
                            {effectiveValues.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {exercise.sets} sets × {exercise.reps} reps
                            {exercise.weight > 0 && ` • ${exercise.weight}kg`}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <Badge
                                variant="outline"
                                className="text-xs bg-[hsl(210,100%,95%)] text-[hsl(210,100%,40%)] border-[hsl(210,100%,85%)] dark:bg-[hsl(210,100%,20%)] dark:text-[hsl(210,100%,80%)]"
                            >
                                {effectiveValues.primaryMuscle}
                            </Badge>
                            {isCustomized && effectiveValues.name !== exercise.exerciseDef.name && (
                                <span className="text-[10px] text-muted-foreground/70 truncate max-w-[120px]">
                                    Based on: {exercise.exerciseDef.name}
                                </span>
                            )}
                        </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onDelete}
                            className="h-9 w-9 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
