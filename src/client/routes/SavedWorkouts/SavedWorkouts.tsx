import { useState } from 'react';
import { Button } from '@/client/components/ui/button';
import { Card, CardContent } from '@/client/components/ui/card';
import { Input } from '@/client/components/ui/input';
import { Label } from '@/client/components/ui/label';
import { Skeleton } from '@/client/components/ui/skeleton';
import { Badge } from '@/client/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/client/components/ui/dialog';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/client/components/ui/sheet';
import {
    ChevronLeft,
    Dumbbell,
    Search,
    Trash2,
    Edit2,
    Copy,
    Play,
    Info,
    Plus,
    ChevronUp,
    ChevronDown,
    X,
    Check,
} from 'lucide-react';
import { useRouter } from '../../router';
import {
    useSavedWorkouts,
    useUpdateSavedWorkout,
    useDeleteSavedWorkout,
    useCreateSavedWorkout,
} from '../Home/hooks';
import type { SavedWorkoutWithExercises, SavedWorkoutExerciseWithDef } from '@/apis/saved-workouts/types';
import { ExerciseDetails } from '@/client/components/ExerciseDetails/ExerciseDetails';
import { toast } from '@/client/components/ui/toast';
import { useQuery } from '@tanstack/react-query';
import { useQueryDefaults } from '@/client/query';
import { listPlanExercises } from '@/apis/plan-exercises/client';
import { useActivePlanId } from '@/client/features/workout';
import Image from 'next/image';

export function SavedWorkouts() {
    const { navigate } = useRouter();

    // Queries and mutations
    const { data, isLoading, error } = useSavedWorkouts();
    const updateMutation = useUpdateSavedWorkout();
    const deleteMutation = useDeleteSavedWorkout();
    const duplicateMutation = useCreateSavedWorkout();

    // Active plan for adding exercises
    const activePlanId = useActivePlanId();
    const queryDefaults = useQueryDefaults();
    const { data: planExercisesData } = useQuery({
        queryKey: ['plan-exercises', activePlanId],
        queryFn: async () => {
            if (!activePlanId) return { exercises: [] };
            const response = await listPlanExercises({ planId: activePlanId });
            return response.data || { exercises: [] };
        },
        enabled: !!activePlanId,
        ...queryDefaults,
    });
    const planExercises = planExercisesData?.exercises || [];

    // UI State
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral search filter
    const [searchQuery, setSearchQuery] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog context
    const [workoutToEdit, setWorkoutToEdit] = useState<SavedWorkoutWithExercises | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
    const [editName, setEditName] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog context
    const [workoutToDelete, setWorkoutToDelete] = useState<SavedWorkoutWithExercises | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral sheet state
    const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral sheet context
    const [workoutToView, setWorkoutToView] = useState<SavedWorkoutWithExercises | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [exerciseDetailsOpen, setExerciseDetailsOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog context
    const [selectedExercise, setSelectedExercise] = useState<SavedWorkoutWithExercises['exercises'][0] | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral edit mode state
    const [isEditMode, setIsEditMode] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral edit state for exercises
    const [editedExercises, setEditedExercises] = useState<SavedWorkoutExerciseWithDef[]>([]);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [addExerciseDialogOpen, setAddExerciseDialogOpen] = useState(false);

    const workouts = data?.workouts || [];

    // Filter workouts by search query
    const filteredWorkouts = workouts.filter((workout) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            workout.name.toLowerCase().includes(query) ||
            workout.exercises.some((ex) => ex.exerciseDef.name.toLowerCase().includes(query))
        );
    });

    const handleEditClick = (workout: SavedWorkoutWithExercises) => {
        setWorkoutToEdit(workout);
        setEditName(workout.name);
        setEditDialogOpen(true);
    };

    const handleSaveEdit = () => {
        if (!workoutToEdit || !editName.trim()) return;

        updateMutation.mutate(
            { workoutId: workoutToEdit._id, name: editName.trim() },
            {
                onSuccess: () => {
                    setEditDialogOpen(false);
                    setWorkoutToEdit(null);
                },
            }
        );
    };

    const handleDeleteClick = (workout: SavedWorkoutWithExercises) => {
        setWorkoutToDelete(workout);
        setDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (!workoutToDelete) return;

        deleteMutation.mutate(
            { workoutId: workoutToDelete._id },
            {
                onSuccess: () => {
                    setDeleteDialogOpen(false);
                    setWorkoutToDelete(null);
                },
            }
        );
    };

    const handleDuplicate = (workout: SavedWorkoutWithExercises) => {
        duplicateMutation.mutate({
            name: `${workout.name} (Copy)`,
            exercises: workout.exercises.map((ex) => ({
                exerciseDefId: ex.exerciseDefId,
                sets: ex.sets,
                reps: ex.reps,
                weight: ex.weight,
                durationSeconds: ex.durationSeconds,
            })),
            exerciseDefs: workout.exercises.map((ex) => ex.exerciseDef),
        });
    };

    const handleViewDetails = (workout: SavedWorkoutWithExercises) => {
        setWorkoutToView(workout);
        setEditedExercises([...workout.exercises]);
        setIsEditMode(false);
        setDetailsSheetOpen(true);
    };

    const handleExerciseInfo = (exercise: SavedWorkoutWithExercises['exercises'][0]) => {
        setSelectedExercise(exercise);
        setExerciseDetailsOpen(true);
    };

    // Edit mode handlers
    const handleEnterEditMode = () => {
        if (workoutToView) {
            setEditedExercises([...workoutToView.exercises]);
            setIsEditMode(true);
        }
    };

    const handleCancelEdit = () => {
        setIsEditMode(false);
        if (workoutToView) {
            setEditedExercises([...workoutToView.exercises]);
        }
    };

    const handleSaveExercises = () => {
        if (!workoutToView || editedExercises.length === 0) {
            toast.error('At least one exercise is required');
            return;
        }

        updateMutation.mutate(
            {
                workoutId: workoutToView._id,
                exercises: editedExercises.map((ex) => ({
                    exerciseDefId: ex.exerciseDefId,
                    sets: ex.sets,
                    reps: ex.reps,
                    weight: ex.weight,
                    durationSeconds: ex.durationSeconds,
                })),
            },
            {
                onSuccess: () => {
                    setIsEditMode(false);
                    // Update the local workout view
                    setWorkoutToView((prev) =>
                        prev ? { ...prev, exercises: editedExercises } : null
                    );
                    toast.success('Workout updated');
                },
                onError: (err) => {
                    toast.error(`Failed to update: ${err.message}`);
                },
            }
        );
    };

    const handleRemoveExercise = (index: number) => {
        setEditedExercises((prev) => prev.filter((_, i) => i !== index));
    };

    const handleMoveUp = (index: number) => {
        if (index === 0) return;
        setEditedExercises((prev) => {
            const items = [...prev];
            [items[index - 1], items[index]] = [items[index], items[index - 1]];
            return items.map((item, i) => ({ ...item, order: i }));
        });
    };

    const handleMoveDown = (index: number) => {
        if (index === editedExercises.length - 1) return;
        setEditedExercises((prev) => {
            const items = [...prev];
            [items[index], items[index + 1]] = [items[index + 1], items[index]];
            return items.map((item, i) => ({ ...item, order: i }));
        });
    };

    // Add exercises from plan
    const handleAddExercises = () => {
        setAddExerciseDialogOpen(true);
    };

    const handleSelectExerciseToAdd = (planExercise: typeof planExercises[0]) => {
        // Check if already in workout
        const alreadyExists = editedExercises.some(
            (ex) => ex.exerciseDefId === planExercise.exerciseDefId
        );

        if (alreadyExists) {
            toast.info('This exercise is already in the workout');
            return;
        }

        // Add exercise to edited list
        const newExercise: SavedWorkoutExerciseWithDef = {
            exerciseDefId: planExercise.exerciseDefId,
            sets: planExercise.sets,
            reps: planExercise.reps,
            weight: planExercise.weight,
            durationSeconds: planExercise.durationSeconds,
            order: editedExercises.length,
            exerciseDef: planExercise.exerciseDef,
        };

        setEditedExercises((prev) => [...prev, newExercise]);
        toast.success(`Added ${planExercise.exerciseDef.name}`);
    };

    // Filter plan exercises that aren't already in the workout
    const availablePlanExercises = planExercises.filter(
        (pe) => !editedExercises.some((ex) => ex.exerciseDefId === pe.exerciseDefId)
    );

    // Loading state
    if (isLoading && !data) {
        return (
            <div className="p-4 pb-20 space-y-4">
                <div className="flex items-center gap-3 mb-4">
                    <Skeleton className="h-10 w-10" />
                    <Skeleton className="h-6 w-48" />
                </div>
                <Skeleton className="h-10 w-full" />
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="p-4 pb-20">
                <div className="flex items-center gap-3 mb-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-xl font-semibold">Saved Workouts</h1>
                </div>
                <Card className="rounded-2xl border-destructive bg-destructive/10 p-4">
                    <p className="text-destructive">
                        Failed to load workouts: {error instanceof Error ? error.message : 'Unknown error'}
                    </p>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-4 pb-20 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate('/')}
                    className="rounded-full"
                >
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-xl font-semibold">Saved Workouts</h1>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search workouts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 rounded-xl"
                />
            </div>

            {/* Empty state */}
            {workouts.length === 0 ? (
                <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Dumbbell className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No saved workouts yet</h3>
                        <p className="text-sm text-muted-foreground text-center">
                            Save workouts from the home page to access them here
                        </p>
                    </CardContent>
                </Card>
            ) : filteredWorkouts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                    No workouts match your search
                </div>
            ) : (
                /* Workout list */
                <div className="space-y-3">
                    {filteredWorkouts.map((workout) => (
                        <Card
                            key={workout._id}
                            className="rounded-xl border-0 shadow-sm active:scale-[0.98] transition-transform"
                        >
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold truncate">{workout.name}</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleViewDetails(workout)}
                                            className="h-8 w-8 rounded-full"
                                        >
                                            <Info className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleEditClick(workout)}
                                            className="h-8 w-8 rounded-full"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDuplicate(workout)}
                                            disabled={duplicateMutation.isPending}
                                            className="h-8 w-8 rounded-full"
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteClick(workout)}
                                            className="h-8 w-8 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {workout.exercises.slice(0, 4).map((ex, i) => (
                                        <Badge key={i} variant="secondary" className="text-xs">
                                            {ex.exerciseDef.name}
                                        </Badge>
                                    ))}
                                    {workout.exercises.length > 4 && (
                                        <Badge variant="outline" className="text-xs">
                                            +{workout.exercises.length - 4} more
                                        </Badge>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Edit Name Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Rename Workout</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="workout-name">Name</Label>
                        <Input
                            id="workout-name"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Workout name"
                            className="mt-2 rounded-lg"
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setEditDialogOpen(false)}
                            className="rounded-lg"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveEdit}
                            disabled={!editName.trim() || updateMutation.isPending}
                            className="rounded-lg"
                        >
                            {updateMutation.isPending ? 'Saving...' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Delete Workout?</DialogTitle>
                        <DialogDescription>
                            This will permanently delete &quot;{workoutToDelete?.name}&quot;. This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteDialogOpen(false)}
                            className="rounded-lg"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDelete}
                            disabled={deleteMutation.isPending}
                            className="rounded-lg"
                        >
                            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Details Sheet with Edit Mode */}
            <Sheet open={detailsSheetOpen} onOpenChange={(open) => {
                if (!open) {
                    setIsEditMode(false);
                }
                setDetailsSheetOpen(open);
            }}>
                <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto">
                    <div className="mx-auto w-12 h-1.5 bg-muted rounded-full mb-4" />
                    <SheetHeader className="text-left">
                        <div className="flex items-center justify-between">
                            <SheetTitle className="text-xl font-bold">{workoutToView?.name}</SheetTitle>
                            {!isEditMode ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleEnterEditMode}
                                    className="rounded-lg"
                                >
                                    <Edit2 className="h-4 w-4 mr-2" />
                                    Edit
                                </Button>
                            ) : (
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCancelEdit}
                                        className="rounded-lg"
                                    >
                                        <X className="h-4 w-4 mr-1" />
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleSaveExercises}
                                        disabled={updateMutation.isPending}
                                        className="rounded-lg"
                                    >
                                        <Check className="h-4 w-4 mr-1" />
                                        {updateMutation.isPending ? 'Saving...' : 'Save'}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </SheetHeader>

                    {/* Add Exercise Button (only in edit mode) */}
                    {isEditMode && activePlanId && (
                        <Button
                            variant="outline"
                            onClick={handleAddExercises}
                            className="w-full mt-4 rounded-xl border-dashed"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Exercise from Plan
                        </Button>
                    )}

                    {/* Exercise List */}
                    <div className="mt-4 space-y-3">
                        {isEditMode ? (
                            <div className="space-y-3">
                                {editedExercises.map((exercise, index) => (
                                    <Card
                                        key={`${exercise.exerciseDefId}-${index}`}
                                        className="rounded-xl border-0 shadow-sm"
                                    >
                                        <CardContent className="p-3">
                                            <div className="flex items-center gap-2">
                                                {/* Reorder buttons */}
                                                <div className="flex flex-col -my-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleMoveUp(index)}
                                                        disabled={index === 0}
                                                        className="h-6 w-6 rounded-md"
                                                    >
                                                        <ChevronUp className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleMoveDown(index)}
                                                        disabled={index === editedExercises.length - 1}
                                                        className="h-6 w-6 rounded-md"
                                                    >
                                                        <ChevronDown className="h-4 w-4" />
                                                    </Button>
                                                </div>

                                                {/* Exercise image */}
                                                <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                                                    {exercise.exerciseDef.imageUrl ? (
                                                        <Image
                                                            src={exercise.exerciseDef.imageUrl}
                                                            alt={exercise.exerciseDef.name}
                                                            width={48}
                                                            height={48}
                                                            className="w-full h-full object-contain"
                                                            unoptimized
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Dumbbell className="h-5 w-5 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Exercise info */}
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-semibold truncate">
                                                        {exercise.exerciseDef.name}
                                                    </h4>
                                                    <p className="text-sm text-muted-foreground">
                                                        {exercise.sets} sets × {exercise.reps} reps
                                                        {exercise.weight > 0 && ` • ${exercise.weight}kg`}
                                                    </p>
                                                </div>

                                                {/* Remove button */}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleRemoveExercise(index)}
                                                    className="h-8 w-8 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            workoutToView?.exercises.map((exercise, index) => (
                                <Card key={index} className="rounded-xl border-0 shadow-sm">
                                    <CardContent className="p-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                                                {exercise.exerciseDef.imageUrl ? (
                                                    <Image
                                                        src={exercise.exerciseDef.imageUrl}
                                                        alt={exercise.exerciseDef.name}
                                                        width={48}
                                                        height={48}
                                                        className="w-full h-full object-contain"
                                                        unoptimized
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Dumbbell className="h-5 w-5 text-muted-foreground" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-semibold truncate">{exercise.exerciseDef.name}</h4>
                                                <p className="text-sm text-muted-foreground">
                                                    {exercise.sets} sets × {exercise.reps} reps
                                                    {exercise.weight > 0 && ` • ${exercise.weight}kg`}
                                                </p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleExerciseInfo(exercise)}
                                                className="h-8 w-8 rounded-full text-primary"
                                            >
                                                <Info className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>

                    {/* Action buttons */}
                    {!isEditMode && (
                        <div className="mt-6 pb-4">
                            <Button
                                onClick={() => setDetailsSheetOpen(false)}
                                className="w-full h-12 rounded-xl"
                            >
                                <Play className="h-4 w-4 mr-2" />
                                Start This Workout
                            </Button>
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            {/* Add Exercise Dialog */}
            <Dialog open={addExerciseDialogOpen} onOpenChange={setAddExerciseDialogOpen}>
                <DialogContent className="rounded-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Add Exercise from Plan</DialogTitle>
                        <DialogDescription>
                            Select exercises from your active training plan to add to this workout.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-3">
                        {availablePlanExercises.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Dumbbell className="h-10 w-10 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">
                                    {planExercises.length === 0
                                        ? 'No exercises in your active plan'
                                        : 'All exercises already added'}
                                </p>
                            </div>
                        ) : (
                            availablePlanExercises.map((exercise) => (
                                <Card
                                    key={exercise._id}
                                    className="rounded-xl border-0 shadow-sm cursor-pointer hover:bg-muted/50 active:scale-[0.98] transition-all"
                                    onClick={() => handleSelectExerciseToAdd(exercise)}
                                >
                                    <CardContent className="p-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                                                {exercise.exerciseDef.imageUrl ? (
                                                    <Image
                                                        src={exercise.exerciseDef.imageUrl}
                                                        alt={exercise.exerciseDef.name}
                                                        width={48}
                                                        height={48}
                                                        className="w-full h-full object-contain"
                                                        unoptimized
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Dumbbell className="h-5 w-5 text-muted-foreground" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-semibold truncate">
                                                    {exercise.exerciseDef.name}
                                                </h4>
                                                <p className="text-sm text-muted-foreground">
                                                    {exercise.sets} sets × {exercise.reps} reps
                                                    {exercise.weight > 0 && ` • ${exercise.weight}kg`}
                                                </p>
                                            </div>
                                            <Plus className="h-5 w-5 text-primary" />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setAddExerciseDialogOpen(false)}
                            className="rounded-lg w-full"
                        >
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Exercise Details */}
            <ExerciseDetails
                exercise={selectedExercise?.exerciseDef || null}
                open={exerciseDetailsOpen}
                onOpenChange={setExerciseDetailsOpen}
                sets={selectedExercise?.sets}
                reps={selectedExercise?.reps}
                weight={selectedExercise?.weight}
                durationSeconds={selectedExercise?.durationSeconds}
            />
        </div>
    );
}
