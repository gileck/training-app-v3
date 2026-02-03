import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/client/components/template/ui/button';
import { Input } from '@/client/components/template/ui/input';
import { Textarea } from '@/client/components/template/ui/textarea';
import { Label } from '@/client/components/template/ui/label';
import { Dumbbell } from 'lucide-react';
import type { ExerciseDefinitionClient } from '@/server/database/collections/exerciseDefinitions/types';

interface ExerciseConfigFormProps {
    exercise: ExerciseDefinitionClient;
    initialSets?: number;
    initialReps?: number;
    initialWeight?: number;
    initialComments?: string;
    onSubmit: (config: { sets: number; reps: number; weight: number; comments: string }) => void;
    onBack: () => void;
    isPending: boolean;
    submitLabel?: string;
}

export function ExerciseConfigForm({
    exercise,
    initialSets = 3,
    initialReps,
    initialWeight,
    initialComments = '',
    onSubmit,
    onBack,
    isPending,
    submitLabel = 'Add to Plan',
}: ExerciseConfigFormProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [sets, setSets] = useState(initialSets);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [reps, setReps] = useState(initialReps ?? (exercise.isStatic ? 0 : 12));
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [weight, setWeight] = useState(initialWeight ?? (exercise.isBodyweight ? 0 : 20));
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [comments, setComments] = useState(initialComments);

    const handleSubmit = () => {
        onSubmit({ sets, reps, weight, comments: comments.trim() });
    };

    return (
        <>
            <div className="flex-1 overflow-y-auto px-5 py-5">
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden flex-shrink-0 relative">
                            {exercise.imageUrl ? (
                                <Image
                                    src={exercise.imageUrl}
                                    alt={exercise.name}
                                    fill
                                    className="object-contain"
                                    unoptimized
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Dumbbell className="h-8 w-8 text-muted-foreground" />
                                </div>
                            )}
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">{exercise.name}</h3>
                            <p className="text-sm text-muted-foreground">
                                {exercise.primaryMuscle} • {exercise.type}
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label>Sets</Label>
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setSets((s) => Math.max(1, s - 1))}
                                    className="h-11 w-11 rounded-lg"
                                >
                                    -
                                </Button>
                                <span className="w-12 text-center font-semibold text-xl">
                                    {sets}
                                </span>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setSets((s) => Math.min(10, s + 1))}
                                    className="h-11 w-11 rounded-lg"
                                >
                                    +
                                </Button>
                            </div>
                        </div>

                        {!exercise.isStatic && (
                            <div className="grid gap-2">
                                <Label>Reps</Label>
                                <div className="flex items-center gap-3">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setReps((r) => Math.max(1, r - 1))}
                                        className="h-11 w-11 rounded-lg"
                                    >
                                        -
                                    </Button>
                                    <span className="w-12 text-center font-semibold text-xl">
                                        {reps}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setReps((r) => Math.min(50, r + 1))}
                                        className="h-11 w-11 rounded-lg"
                                    >
                                        +
                                    </Button>
                                </div>
                            </div>
                        )}

                        {!exercise.isBodyweight && (
                            <div className="grid gap-2">
                                <Label>Weight (kg)</Label>
                                <Input
                                    type="number"
                                    value={weight}
                                    onChange={(e) => setWeight(Number(e.target.value))}
                                    className="rounded-lg"
                                />
                            </div>
                        )}

                        <div className="grid gap-2">
                            <Label>Notes (optional)</Label>
                            <Textarea
                                value={comments}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setComments(e.target.value)}
                                placeholder="Add any notes or reminders..."
                                className="rounded-lg resize-none"
                                rows={3}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t px-5 py-4 flex gap-3">
                <Button
                    variant="outline"
                    onClick={onBack}
                    className="flex-1 h-12 rounded-xl"
                >
                    Back
                </Button>
                <Button
                    onClick={handleSubmit}
                    disabled={isPending}
                    className="flex-1 h-12 rounded-xl"
                >
                    {isPending ? 'Adding...' : submitLabel}
                </Button>
            </div>
        </>
    );
}
