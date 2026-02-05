import Image from 'next/image';
import { Button } from '@/client/components/template/ui/button';
import { Badge } from '@/client/components/template/ui/badge';
import { Check, Dumbbell, Edit2, Trash2 } from 'lucide-react';
import type { ExerciseDefinitionClient } from '@/server/database/collections/project/exerciseDefinitions/types';

interface ExerciseLibraryGridProps {
    exercises: ExerciseDefinitionClient[];
    addedExerciseIds: Set<string>;
    selectedExerciseIds: Set<string>;
    isMultiSelectMode: boolean;
    onSelect: (exercise: ExerciseDefinitionClient) => void;
    onMultiSelect: (exercise: ExerciseDefinitionClient) => void;
    onEditDef: (exercise: ExerciseDefinitionClient) => void;
    onDeleteDef: (exercise: ExerciseDefinitionClient) => void;
}

export function ExerciseLibraryGrid({
    exercises,
    addedExerciseIds,
    selectedExerciseIds,
    isMultiSelectMode,
    onSelect,
    onMultiSelect,
    onEditDef,
    onDeleteDef,
}: ExerciseLibraryGridProps) {
    return (
        <div className="grid grid-cols-2 gap-3 py-1">
            {exercises.map((exercise) => {
                const isInPlan = addedExerciseIds.has(exercise._id);
                const isSelected = selectedExerciseIds.has(exercise._id);
                return (
                    <button
                        key={exercise._id}
                        onClick={() => {
                            if (isInPlan) return;
                            if (isMultiSelectMode) {
                                onMultiSelect(exercise);
                            } else {
                                onSelect(exercise);
                            }
                        }}
                        disabled={isInPlan}
                        className={`relative rounded-xl overflow-hidden text-left transition-all active:scale-[0.98] ring-2 ${
                            isInPlan
                                ? 'opacity-60 cursor-default ring-transparent'
                                : isSelected
                                ? 'ring-primary'
                                : 'ring-transparent hover:ring-muted-foreground/20'
                        }`}
                    >
                        {/* Image */}
                        <div className="aspect-square w-full bg-muted relative">
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
                                    <Dumbbell className="h-12 w-12 text-muted-foreground" />
                                </div>
                            )}
                            {/* Status overlay */}
                            {(isInPlan || isSelected) && (
                                <div className={`absolute inset-0 flex items-center justify-center ${
                                    isInPlan ? 'bg-primary/20' : 'bg-primary/30'
                                }`}>
                                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                                        <Check className="h-6 w-6 text-primary-foreground" />
                                    </div>
                                </div>
                            )}
                            {/* Custom exercise actions */}
                            {!exercise.isSystem && (
                                <div className="absolute top-2 right-2 flex gap-1">
                                    <Button
                                        variant="secondary"
                                        size="icon"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEditDef(exercise);
                                        }}
                                        className="h-7 w-7 rounded-full bg-background/80 backdrop-blur-sm"
                                    >
                                        <Edit2 className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="icon"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteDef(exercise);
                                        }}
                                        className="h-7 w-7 rounded-full bg-background/80 backdrop-blur-sm text-destructive hover:text-destructive"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            )}
                        </div>
                        {/* Info */}
                        <div className="p-3 bg-card">
                            <div className="flex items-start gap-1 mb-1">
                                <p className="font-medium text-sm leading-tight line-clamp-2 flex-1">{exercise.name}</p>
                                {isInPlan && (
                                    <Badge variant="outline" className="text-[10px] shrink-0 text-primary border-primary/50 px-1.5 py-0">
                                        In Plan
                                    </Badge>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                                {exercise.primaryMuscle} • {exercise.type}
                            </p>
                            {!exercise.isSystem && (
                                <Badge variant="secondary" className="text-[10px] mt-1.5 px-1.5 py-0">
                                    Custom
                                </Badge>
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
