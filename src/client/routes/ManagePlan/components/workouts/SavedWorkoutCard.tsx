import Image from 'next/image';
import { Button } from '@/client/components/ui/button';
import { Card, CardContent } from '@/client/components/ui/card';
import { ChevronRight, ChevronUp, ChevronDown, Edit2, Copy, Trash2, Dumbbell } from 'lucide-react';
import type { SavedWorkoutWithExercises } from '@/apis/saved-workouts/types';

interface SavedWorkoutCardProps {
    workout: SavedWorkoutWithExercises;
    index: number;
    isFirst: boolean;
    isLast: boolean;
    isExpanded: boolean;
    isReorderMode: boolean;
    isReorderPending: boolean;
    isDuplicatePending: boolean;
    onToggleExpand: () => void;
    onEdit: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
}

export function SavedWorkoutCard({
    workout,
    isFirst,
    isLast,
    isExpanded,
    isReorderMode,
    isReorderPending,
    isDuplicatePending,
    onToggleExpand,
    onEdit,
    onDuplicate,
    onDelete,
    onMoveUp,
    onMoveDown,
}: SavedWorkoutCardProps) {
    return (
        <Card className="rounded-xl border-0 shadow-sm overflow-hidden">
            <CardContent className="p-0">
                {/* Header - clickable to expand */}
                <div
                    className="p-4 cursor-pointer active:bg-muted/50 transition-colors"
                    onClick={() => !isReorderMode && onToggleExpand()}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            {/* Reorder buttons - only show in reorder mode */}
                            {isReorderMode ? (
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
                            ) : (
                                <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold truncate">{workout.name}</h3>
                                <p className="text-sm text-muted-foreground">
                                    {workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''}
                                </p>
                            </div>
                        </div>
                        {!isReorderMode && (
                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onEdit}
                                    className="h-8 w-8 rounded-full"
                                >
                                    <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onDuplicate}
                                    disabled={isDuplicatePending}
                                    className="h-8 w-8 rounded-full"
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onDelete}
                                    className="h-8 w-8 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Expandable exercise list */}
                {isExpanded && (
                    <div className="border-t bg-muted/30">
                        {workout.exercises.map((ex, index) => (
                            <div
                                key={ex.exerciseDefId}
                                className={`flex items-center gap-3 p-3 ${index !== workout.exercises.length - 1 ? 'border-b border-border/50' : ''}`}
                            >
                                <div className="w-12 h-12 rounded-lg bg-background overflow-hidden flex-shrink-0 relative">
                                    {ex.exerciseDef.imageUrl ? (
                                        <Image
                                            src={ex.exerciseDef.imageUrl}
                                            alt={ex.exerciseDef.name}
                                            fill
                                            className="object-contain"
                                            unoptimized
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Dumbbell className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-sm truncate">
                                        {ex.exerciseDef.name}
                                    </h4>
                                    <p className="text-xs text-muted-foreground">
                                        {ex.sets} sets × {ex.reps} reps
                                        {ex.weight > 0 && ` • ${ex.weight}kg`}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
