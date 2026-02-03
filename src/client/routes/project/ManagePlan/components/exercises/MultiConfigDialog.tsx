import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/client/components/template/ui/button';
import { Card, CardContent } from '@/client/components/template/ui/card';
import { Input } from '@/client/components/template/ui/input';
import { Textarea } from '@/client/components/template/ui/textarea';
import { Label } from '@/client/components/template/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/client/components/template/ui/dialog';
import { Dumbbell, MessageSquare, X } from 'lucide-react';
import type { MultiSelectExerciseConfig } from '../../types';

interface MultiConfigDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedExercises: Map<string, MultiSelectExerciseConfig>;
    onUpdateConfig: (exerciseId: string, field: 'sets' | 'reps' | 'weight' | 'comments', value: number | string) => void;
    onRemove: (exerciseId: string) => void;
    onSubmit: () => void;
    isPending: boolean;
}

export function MultiConfigDialog({
    open,
    onOpenChange,
    selectedExercises,
    onUpdateConfig,
    onRemove,
    onSubmit,
    isPending,
}: MultiConfigDialogProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral notes dialog
    const [notesDialogExerciseId, setNotesDialogExerciseId] = useState<string | null>(null);

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-h-[90vh] overflow-y-auto p-4">
                    <DialogHeader className="pb-2">
                        <DialogTitle className="text-lg">Configure Exercises</DialogTitle>
                        <DialogDescription className="text-sm">
                            Set up {selectedExercises.size} exercise{selectedExercises.size > 1 ? 's' : ''}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        {Array.from(selectedExercises.entries()).map(([exerciseId, item]) => (
                            <Card key={exerciseId} className="rounded-xl border-0 bg-muted/50">
                                <CardContent className="p-3 space-y-3">
                                    {/* Exercise header */}
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-lg bg-background overflow-hidden flex-shrink-0 relative">
                                            {item.exercise.imageUrl ? (
                                                <Image
                                                    src={item.exercise.imageUrl}
                                                    alt={item.exercise.name}
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
                                            <p className="font-semibold text-sm truncate">{item.exercise.name}</p>
                                            <p className="text-xs text-muted-foreground">{item.exercise.primaryMuscle}</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setNotesDialogExerciseId(exerciseId)}
                                            className={`h-9 w-9 rounded-full ${item.comments ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}
                                        >
                                            <MessageSquare className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onRemove(exerciseId)}
                                            className="h-9 w-9 rounded-full text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    {/* Configuration rows */}
                                    <div className="space-y-2">
                                        {/* Sets row */}
                                        <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2">
                                            <Label className="text-sm font-medium">Sets</Label>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => onUpdateConfig(exerciseId, 'sets', Math.max(1, item.sets - 1))}
                                                    className="h-9 w-9 rounded-lg"
                                                >
                                                    -
                                                </Button>
                                                <span className="w-8 text-center font-semibold text-lg">{item.sets}</span>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => onUpdateConfig(exerciseId, 'sets', Math.min(10, item.sets + 1))}
                                                    className="h-9 w-9 rounded-lg"
                                                >
                                                    +
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Reps row */}
                                        {!item.exercise.isStatic && (
                                            <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2">
                                                <Label className="text-sm font-medium">Reps</Label>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => onUpdateConfig(exerciseId, 'reps', Math.max(1, item.reps - 1))}
                                                        className="h-9 w-9 rounded-lg"
                                                    >
                                                        -
                                                    </Button>
                                                    <span className="w-8 text-center font-semibold text-lg">{item.reps}</span>
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => onUpdateConfig(exerciseId, 'reps', Math.min(50, item.reps + 1))}
                                                        className="h-9 w-9 rounded-lg"
                                                    >
                                                        +
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Weight row */}
                                        {!item.exercise.isBodyweight && (
                                            <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2">
                                                <Label className="text-sm font-medium">Weight (kg)</Label>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => onUpdateConfig(exerciseId, 'weight', Math.max(0, item.weight - 1))}
                                                        className="h-9 w-9 rounded-lg"
                                                    >
                                                        -
                                                    </Button>
                                                    <Input
                                                        type="number"
                                                        value={item.weight}
                                                        onChange={(e) => onUpdateConfig(exerciseId, 'weight', Number(e.target.value))}
                                                        className="w-20 h-9 rounded-lg text-center font-semibold"
                                                    />
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => onUpdateConfig(exerciseId, 'weight', item.weight + 1)}
                                                        className="h-9 w-9 rounded-lg"
                                                    >
                                                        +
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    <div className="flex flex-col gap-2 pt-2">
                        <Button
                            onClick={onSubmit}
                            disabled={isPending || selectedExercises.size === 0}
                            className="w-full h-12 rounded-xl text-base font-semibold"
                        >
                            {isPending ? 'Adding...' : `Add ${selectedExercises.size} to Plan`}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="w-full h-11 rounded-xl"
                        >
                            Back
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Notes Dialog */}
            <Dialog open={!!notesDialogExerciseId} onOpenChange={(open) => !open && setNotesDialogExerciseId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Notes</DialogTitle>
                    </DialogHeader>
                    <Textarea
                        value={notesDialogExerciseId ? selectedExercises.get(notesDialogExerciseId)?.comments || '' : ''}
                        onChange={(e) => {
                            if (notesDialogExerciseId) {
                                onUpdateConfig(notesDialogExerciseId, 'comments', e.target.value);
                            }
                        }}
                        placeholder="Add any notes or reminders..."
                        className="rounded-lg resize-none"
                        rows={4}
                    />
                    <DialogFooter>
                        <Button onClick={() => setNotesDialogExerciseId(null)} className="rounded-xl">
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
