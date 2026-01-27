import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/client/components/ui/button';
import { Input } from '@/client/components/ui/input';
import { Textarea } from '@/client/components/ui/textarea';
import { Label } from '@/client/components/ui/label';
import { Dumbbell, ChevronDown, Settings2 } from 'lucide-react';
import type { ExerciseDefinitionClient } from '@/server/database/collections/exerciseDefinitions/types';
import type { ExerciseOverrides } from '@/client/features/plan-data/types';
import { CustomizeExerciseSheet } from './CustomizeExerciseSheet';
import { getEffectiveExerciseValues } from '../../utils/exerciseOverrides';

interface ExerciseConfigFormProps {
    exercise: ExerciseDefinitionClient;
    initialSets?: number;
    initialReps?: number;
    initialWeight?: number;
    initialComments?: string;
    initialOverrides?: ExerciseOverrides;
    onSubmit: (config: { sets: number; reps: number; weight: number; comments: string; overrides?: ExerciseOverrides }) => void;
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
    initialOverrides,
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
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [customizeOpen, setCustomizeOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [overrides, setOverrides] = useState<ExerciseOverrides | undefined>(initialOverrides);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [customizeExpanded, setCustomizeExpanded] = useState(false);

    // Get effective values for display
    const effectiveValues = getEffectiveExerciseValues(exercise, overrides);
    const hasOverrides = overrides && Object.keys(overrides).length > 0;

    const handleSubmit = () => {
        onSubmit({ sets, reps, weight, comments: comments.trim(), overrides });
    };

    const handleCustomizeSave = (newOverrides: ExerciseOverrides | undefined) => {
        setOverrides(newOverrides);
        setCustomizeOpen(false);
    };

    return (
        <>
            <div className="flex-1 overflow-y-auto px-5 py-5">
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden flex-shrink-0 relative">
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
                                    <Dumbbell className="h-8 w-8 text-muted-foreground" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-lg">{effectiveValues.name}</h3>
                            <p className="text-sm text-muted-foreground">
                                {effectiveValues.primaryMuscle} • {effectiveValues.type}
                            </p>
                            {hasOverrides && effectiveValues.name !== exercise.name && (
                                <p className="text-xs text-muted-foreground/70">
                                    Based on: {exercise.name}
                                </p>
                            )}
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

                    {/* Customize Exercise Section */}
                    <div className="space-y-3">
                        <Button
                            variant="outline"
                            onClick={() => setCustomizeExpanded(!customizeExpanded)}
                            className="w-full justify-between h-12 rounded-xl"
                        >
                            <div className="flex items-center gap-2">
                                <Settings2 className="h-4 w-4" />
                                <span>Customize Exercise</span>
                                {hasOverrides && (
                                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                        Modified
                                    </span>
                                )}
                            </div>
                            <ChevronDown className={`h-4 w-4 transition-transform ${customizeExpanded ? 'rotate-180' : ''}`} />
                        </Button>
                        {customizeExpanded && (
                            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                                <p className="text-sm text-muted-foreground">
                                    Customize this exercise&apos;s name, image, muscle groups, and more. 
                                    Changes only apply to this instance in your plan.
                                </p>
                                <Button
                                    variant="secondary"
                                    onClick={() => setCustomizeOpen(true)}
                                    className="w-full"
                                >
                                    <Settings2 className="h-4 w-4 mr-2" />
                                    {hasOverrides ? 'Edit Customizations' : 'Customize Exercise'}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Customize Exercise Sheet */}
            <CustomizeExerciseSheet
                open={customizeOpen}
                onOpenChange={setCustomizeOpen}
                exerciseDef={exercise}
                currentOverrides={overrides}
                onSave={handleCustomizeSave}
            />

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
