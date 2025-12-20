import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/client/components/ui/sheet';
import { Badge } from '@/client/components/ui/badge';
import { Card, CardContent } from '@/client/components/ui/card';
import { Separator } from '@/client/components/ui/separator';
import { Dumbbell, Clock, Weight, RotateCcw, Info } from 'lucide-react';
import type { ExerciseDefinitionClient } from '@/server/database/collections/exerciseDefinitions/types';

interface ExerciseDetailsProps {
    exercise: ExerciseDefinitionClient | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    // Optional exercise configuration
    sets?: number;
    reps?: number;
    weight?: number;
    durationSeconds?: number;
}

export function ExerciseDetails({
    exercise,
    open,
    onOpenChange,
    sets,
    reps,
    weight,
    durationSeconds,
}: ExerciseDetailsProps) {
    if (!exercise) return null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto">
                {/* Drag handle */}
                <div className="mx-auto w-12 h-1.5 bg-muted rounded-full mb-4" />

                <SheetHeader className="text-left">
                    <SheetTitle className="text-xl font-bold pr-8">{exercise.name}</SheetTitle>
                </SheetHeader>

                <div className="mt-4 space-y-4">
                    {/* Exercise image */}
                    <div className="w-full h-48 rounded-xl bg-muted overflow-hidden">
                        {exercise.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={exercise.imageUrl}
                                alt={exercise.name}
                                className="h-full w-full object-contain"
                            />
                        ) : (
                            <div className="h-full w-full flex items-center justify-center">
                                <Dumbbell className="h-16 w-16 text-muted-foreground" />
                            </div>
                        )}
                    </div>

                    {/* Muscle badges */}
                    <div className="flex flex-wrap gap-2">
                        <Badge className="bg-primary/10 text-primary border-primary/30">
                            {exercise.primaryMuscle}
                        </Badge>
                        {exercise.secondaryMuscles.map((muscle) => (
                            <Badge
                                key={muscle}
                                variant="outline"
                                className="bg-[hsl(210,100%,95%)] text-[hsl(210,100%,40%)] border-[hsl(210,100%,85%)] dark:bg-[hsl(210,100%,20%)] dark:text-[hsl(210,100%,80%)] dark:border-[hsl(210,100%,30%)]"
                            >
                                {muscle}
                            </Badge>
                        ))}
                    </div>

                    {/* Exercise attributes */}
                    <div className="flex gap-2">
                        {exercise.isBodyweight && (
                            <Badge variant="secondary" className="gap-1">
                                <Weight className="h-3 w-3" />
                                Bodyweight
                            </Badge>
                        )}
                        {exercise.isStatic && (
                            <Badge variant="secondary" className="gap-1">
                                <Clock className="h-3 w-3" />
                                Static/Timed
                            </Badge>
                        )}
                        <Badge variant="outline" className="gap-1">
                            <Info className="h-3 w-3" />
                            {exercise.type}
                        </Badge>
                    </div>

                    <Separator />

                    {/* Current configuration (if provided) */}
                    {(sets || reps || weight || durationSeconds) && (
                        <>
                            <div>
                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                    <RotateCcw className="h-4 w-4" />
                                    Current Configuration
                                </h3>
                                <Card className="rounded-xl">
                                    <CardContent className="p-4 grid grid-cols-2 gap-4">
                                        {sets !== undefined && (
                                            <div>
                                                <p className="text-2xl font-bold text-primary">{sets}</p>
                                                <p className="text-sm text-muted-foreground">Sets</p>
                                            </div>
                                        )}
                                        {reps !== undefined && reps > 0 && (
                                            <div>
                                                <p className="text-2xl font-bold text-primary">{reps}</p>
                                                <p className="text-sm text-muted-foreground">Reps</p>
                                            </div>
                                        )}
                                        {weight !== undefined && weight > 0 && (
                                            <div>
                                                <p className="text-2xl font-bold text-primary">{weight}kg</p>
                                                <p className="text-sm text-muted-foreground">Weight</p>
                                            </div>
                                        )}
                                        {durationSeconds !== undefined && durationSeconds > 0 && (
                                            <div>
                                                <p className="text-2xl font-bold text-primary">{durationSeconds}s</p>
                                                <p className="text-sm text-muted-foreground">Duration</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                            <Separator />
                        </>
                    )}

                    {/* System/Custom indicator */}
                    <div className="text-sm text-muted-foreground text-center pb-4">
                        {exercise.isSystem ? 'System Exercise' : 'Custom Exercise'}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}


