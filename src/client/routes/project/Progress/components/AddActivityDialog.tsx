import { useState } from 'react';
import { Button } from '@/client/components/template/ui/button';
import { Skeleton } from '@/client/components/template/ui/skeleton';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/client/components/template/ui/dialog';
import {
    Dumbbell,
    Pencil,
    Check,
    Loader2,
    Plus,
    Minus,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { listPlanExercises } from '@/apis/project/plan-exercises/client';
import { usePlans } from '@/client/features/project/workout/hooks';
import { useActivePlanId } from '@/client/features/project/workout/store';
import { useQueryDefaults } from '@/client/query/defaults';
import { DateTimePicker } from './DateTimePicker';

export interface AddActivityDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialDate: Date;
    onSave: (planExerciseId: string, completedAt: string, numberOfSets: number) => void;
    isLoading?: boolean;
}

export function AddActivityDialog({
    open,
    onOpenChange,
    initialDate,
    onSave,
    isLoading,
}: AddActivityDialogProps) {
    const activePlanId = useActivePlanId();
    const { data: plansData } = usePlans();
    const queryDefaults = useQueryDefaults();

    // Fetch exercises for the active plan
    const { data: exercisesData, isLoading: exercisesLoading } = useQuery({
        queryKey: ['plan-exercises', activePlanId],
        queryFn: async () => {
            if (!activePlanId) throw new Error('No active plan');
            const response = await listPlanExercises({ planId: activePlanId });
            if (response.data?.error) throw new Error(response.data.error);
            return response.data;
        },
        enabled: !!activePlanId && open,
        ...queryDefaults,
    });

    const exercises = exercisesData?.exercises || [];
    const activePlan = plansData?.plans?.find((p) => p._id === activePlanId);

    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [numberOfSets, setNumberOfSets] = useState(1);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [selectedDate, setSelectedDate] = useState(initialDate);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [showTimePicker, setShowTimePicker] = useState(false);

    const selectedExercise = exercises.find((e) => e._id === selectedExerciseId);

    const handleSave = () => {
        if (selectedExerciseId) {
            onSave(selectedExerciseId, selectedDate.toISOString(), numberOfSets);
        }
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    if (!activePlanId) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Exercise</DialogTitle>
                    </DialogHeader>
                    <div className="py-8 text-center">
                        <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">
                            No training plan selected. Please select a plan first.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add Exercise</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    {/* Plan Name */}
                    {activePlan && (
                        <div className="text-sm text-muted-foreground">
                            Adding to: <span className="font-medium text-foreground">{activePlan.name}</span>
                        </div>
                    )}

                    {/* Time Selection */}
                    {!showTimePicker ? (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Time</label>
                            <button
                                onClick={() => setShowTimePicker(true)}
                                className="w-full flex items-center justify-between p-3 rounded-lg bg-muted hover:bg-accent transition-colors"
                            >
                                <span className="text-foreground">{formatTime(selectedDate)}</span>
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium">Time</label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowTimePicker(false)}
                                >
                                    Done
                                </Button>
                            </div>
                            <DateTimePicker
                                selectedDate={selectedDate}
                                onDateChange={setSelectedDate}
                            />
                        </div>
                    )}

                    {/* Exercise Selection */}
                    {!showTimePicker && (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Exercise</label>
                                {exercisesLoading ? (
                                    <div className="space-y-2">
                                        {[1, 2, 3].map((i) => (
                                            <Skeleton key={i} className="h-14 w-full rounded-lg" />
                                        ))}
                                    </div>
                                ) : exercises.length === 0 ? (
                                    <div className="text-center py-6 text-muted-foreground">
                                        No exercises in this plan
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                        {exercises.map((exercise) => (
                                            <button
                                                key={exercise._id}
                                                onClick={() => setSelectedExerciseId(exercise._id)}
                                                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                                                    selectedExerciseId === exercise._id
                                                        ? 'bg-primary/10 ring-2 ring-primary'
                                                        : 'bg-muted hover:bg-accent'
                                                }`}
                                            >
                                                {exercise.exerciseDef.imageUrl ? (
                                                    <img
                                                        src={exercise.exerciseDef.imageUrl}
                                                        alt={exercise.exerciseDef.name}
                                                        className="w-10 h-10 rounded-lg object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                                        <Dumbbell className="h-5 w-5 text-primary" />
                                                    </div>
                                                )}
                                                <div className="flex-1 text-left">
                                                    <div className="font-medium text-sm">
                                                        {exercise.exerciseDef.name}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {exercise.sets} sets × {exercise.reps} reps
                                                    </div>
                                                </div>
                                                {selectedExerciseId === exercise._id && (
                                                    <Check className="h-5 w-5 text-primary" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Number of Sets */}
                            {selectedExercise && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Number of Sets</label>
                                    <div className="flex items-center justify-center gap-4">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setNumberOfSets(Math.max(1, numberOfSets - 1))}
                                            disabled={numberOfSets <= 1}
                                            className="h-12 w-12 rounded-xl"
                                        >
                                            <Minus className="h-5 w-5" />
                                        </Button>
                                        <div className="flex flex-col items-center">
                                            <span className="text-3xl font-bold text-primary">
                                                {numberOfSets}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {numberOfSets === 1 ? 'set' : 'sets'}
                                            </span>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setNumberOfSets(Math.min(20, numberOfSets + 1))}
                                            disabled={numberOfSets >= 20}
                                            className="h-12 w-12 rounded-xl"
                                        >
                                            <Plus className="h-5 w-5" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={!selectedExerciseId || isLoading}
                    >
                        {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Add {numberOfSets} {numberOfSets === 1 ? 'Set' : 'Sets'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
