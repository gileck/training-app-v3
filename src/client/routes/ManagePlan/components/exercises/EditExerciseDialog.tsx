import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/client/components/ui/button';
import { Input } from '@/client/components/ui/input';
import { Textarea } from '@/client/components/ui/textarea';
import {
    Dialog,
    DialogContent,
} from '@/client/components/ui/dialog';
import { Dumbbell } from 'lucide-react';
import type { PlanExerciseWithDefinition } from '@/apis/plan-exercises/types';

interface EditExerciseDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    exercise: PlanExerciseWithDefinition | null;
    onSave: (config: { sets: number; reps: number; weight: number; comments: string }) => void;
    isPending: boolean;
}

export function EditExerciseDialog({
    open,
    onOpenChange,
    exercise,
    onSave,
    isPending,
}: EditExerciseDialogProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [sets, setSets] = useState(3);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [reps, setReps] = useState(12);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [weight, setWeight] = useState(0);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [comments, setComments] = useState('');

    // Reset form when exercise changes
    useEffect(() => {
        if (exercise) {
            setSets(exercise.sets);
            setReps(exercise.reps);
            setWeight(exercise.weight);
            setComments(exercise.comments || '');
        }
    }, [exercise]);

    const handleSave = () => {
        onSave({ sets, reps, weight, comments: comments.trim() });
    };

    if (!exercise) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-3xl p-0 gap-0 border-0 shadow-2xl overflow-hidden max-w-sm">
                {/* Header with exercise info */}
                <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 pb-4">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-background shadow-md overflow-hidden flex-shrink-0 relative border border-border/50">
                            {exercise.exerciseDef.imageUrl ? (
                                <Image
                                    src={exercise.exerciseDef.imageUrl}
                                    alt={exercise.exerciseDef.name}
                                    fill
                                    className="object-contain p-1"
                                    unoptimized
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Dumbbell className="h-7 w-7 text-muted-foreground" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg font-bold truncate">{exercise.exerciseDef.name}</h2>
                            <p className="text-sm text-muted-foreground">
                                {exercise.exerciseDef.primaryMuscle}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Configuration controls */}
                <div className="p-6 pt-4 space-y-5">
                    {/* Sets & Reps in a row */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Sets */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Sets
                            </label>
                            <div className="flex items-center justify-between bg-muted/50 rounded-xl p-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setSets((s) => Math.max(1, s - 1))}
                                    className="h-10 w-10 rounded-lg hover:bg-background"
                                >
                                    <span className="text-lg font-medium">−</span>
                                </Button>
                                <span className="text-2xl font-bold tabular-nums">
                                    {sets}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setSets((s) => Math.min(10, s + 1))}
                                    className="h-10 w-10 rounded-lg hover:bg-background"
                                >
                                    <span className="text-lg font-medium">+</span>
                                </Button>
                            </div>
                        </div>

                        {/* Reps */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Reps
                            </label>
                            <div className="flex items-center justify-between bg-muted/50 rounded-xl p-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setReps((r) => Math.max(1, r - 1))}
                                    className="h-10 w-10 rounded-lg hover:bg-background"
                                >
                                    <span className="text-lg font-medium">−</span>
                                </Button>
                                <span className="text-2xl font-bold tabular-nums">
                                    {reps}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setReps((r) => Math.min(50, r + 1))}
                                    className="h-10 w-10 rounded-lg hover:bg-background"
                                >
                                    <span className="text-lg font-medium">+</span>
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Weight */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Weight
                        </label>
                        <div className="flex items-center bg-muted/50 rounded-xl p-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setWeight((w) => Math.max(0, w - 2.5))}
                                className="h-10 w-10 rounded-lg hover:bg-background"
                            >
                                <span className="text-lg font-medium">−</span>
                            </Button>
                            <div className="flex-1 text-center">
                                <Input
                                    type="number"
                                    value={weight}
                                    onChange={(e) => setWeight(Number(e.target.value))}
                                    className="h-10 text-center text-2xl font-bold border-0 bg-transparent focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setWeight((w) => w + 2.5)}
                                className="h-10 w-10 rounded-lg hover:bg-background"
                            >
                                <span className="text-lg font-medium">+</span>
                            </Button>
                            <span className="pr-3 text-sm font-medium text-muted-foreground">kg</span>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Notes
                        </label>
                        <Textarea
                            value={comments}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setComments(e.target.value)}
                            placeholder="Add notes or reminders..."
                            className="rounded-xl resize-none bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/50 min-h-[80px]"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 pt-0 flex gap-3">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="flex-1 h-12 rounded-xl font-semibold"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isPending}
                        className="flex-1 h-12 rounded-xl font-semibold"
                    >
                        {isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
