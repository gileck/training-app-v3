import Image from 'next/image';
import { Button } from '@/client/components/template/ui/button';
import { Badge } from '@/client/components/template/ui/badge';
import { Check, Dumbbell, Edit2, Trash2 } from 'lucide-react';
import type { ExerciseDefinitionClient } from '@/server/database/collections/exerciseDefinitions/types';

interface ExerciseLibraryListProps {
    exercises: ExerciseDefinitionClient[];
    addedExerciseIds: Set<string>;
    selectedExerciseIds: Set<string>;
    isMultiSelectMode: boolean;
    onSelect: (exercise: ExerciseDefinitionClient) => void;
    onMultiSelect: (exercise: ExerciseDefinitionClient) => void;
    onEditDef: (exercise: ExerciseDefinitionClient) => void;
    onDeleteDef: (exercise: ExerciseDefinitionClient) => void;
}

export function ExerciseLibraryList({
    exercises,
    addedExerciseIds,
    selectedExerciseIds,
    isMultiSelectMode,
    onSelect,
    onMultiSelect,
    onEditDef,
    onDeleteDef,
}: ExerciseLibraryListProps) {
    return (
        <div className="divide-y divide-border/50">
            {exercises.map((exercise) => {
                const isInPlan = addedExerciseIds.has(exercise._id);
                const isSelected = selectedExerciseIds.has(exercise._id);
                return (
                    <div
                        key={exercise._id}
                        className={`flex items-center gap-4 py-3.5 transition-all ${
                            isInPlan ? 'bg-muted/30' : isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
                        }`}
                    >
                        <button
                            onClick={() => {
                                if (isInPlan) return;
                                if (isMultiSelectMode) {
                                    onMultiSelect(exercise);
                                } else {
                                    onSelect(exercise);
                                }
                            }}
                            disabled={isInPlan}
                            className={`flex items-center gap-4 flex-1 min-w-0 text-left transition-transform ${
                                isInPlan ? 'opacity-60 cursor-default' : 'active:scale-[0.99]'
                            }`}
                        >
                            <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden flex-shrink-0 relative">
                                {exercise.imageUrl ? (
                                    <Image
                                        src={exercise.imageUrl}
                                        alt={exercise.name}
                                        fill
                                        className="object-contain"
                                        unoptimized
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Dumbbell className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                )}
                                {isInPlan && (
                                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                        <Check className="h-6 w-6 text-primary" />
                                    </div>
                                )}
                                {isSelected && !isInPlan && (
                                    <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                                        <Check className="h-6 w-6 text-primary" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="font-medium text-[15px] truncate">{exercise.name}</p>
                                    {isInPlan && (
                                        <Badge variant="outline" className="text-xs shrink-0 text-primary border-primary/50">
                                            In Plan
                                        </Badge>
                                    )}
                                    {isSelected && !isInPlan && (
                                        <Badge className="text-xs shrink-0">
                                            Selected
                                        </Badge>
                                    )}
                                    {!exercise.isSystem && (
                                        <Badge variant="secondary" className="text-xs shrink-0">
                                            Custom
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    {exercise.primaryMuscle} • {exercise.type}
                                </p>
                            </div>
                        </button>
                        {/* Edit/Delete buttons for custom exercises */}
                        {!exercise.isSystem && (
                            <div className="flex gap-1 shrink-0">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEditDef(exercise);
                                    }}
                                    className="h-8 w-8 rounded-full"
                                >
                                    <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteDef(exercise);
                                    }}
                                    className="h-8 w-8 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
