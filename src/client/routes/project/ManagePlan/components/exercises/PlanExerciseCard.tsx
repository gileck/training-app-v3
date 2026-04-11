import Image from 'next/image';
import { Button } from '@/client/components/template/ui/button';
import { Card, CardContent } from '@/client/components/template/ui/card';
import { Badge } from '@/client/components/template/ui/badge';
import { ChevronUp, ChevronDown, Trash2, Dumbbell } from 'lucide-react';
import type { PlanExerciseWithDefinition } from '@/apis/project/plan-exercises/types';

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
                        {exercise.exerciseDef.imageUrl ? (
                            <Image
                                src={exercise.exerciseDef.imageUrl}
                                alt={exercise.exerciseDef.name}
                                fill
                                className="object-contain"
                                unoptimized
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <Dumbbell className="h-6 w-6 text-muted-foreground" />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">
                            {exercise.exerciseDef.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {exercise.sets} sets × {exercise.exerciseDef.isStatic
                                ? `${exercise.durationSeconds} sec`
                                : `${exercise.reps} reps`}
                            {!exercise.exerciseDef.isBodyweight && exercise.weight > 0 && ` • ${exercise.weight}kg`}
                        </p>
                        <Badge
                            variant="outline"
                            className="mt-1 text-xs bg-[hsl(210,100%,95%)] text-[hsl(210,100%,40%)] border-[hsl(210,100%,85%)] dark:bg-[hsl(210,100%,20%)] dark:text-[hsl(210,100%,80%)]"
                        >
                            {exercise.exerciseDef.primaryMuscle}
                        </Badge>
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
