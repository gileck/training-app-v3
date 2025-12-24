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
import { ChevronLeft, Dumbbell, Search, Trash2, Edit2, Copy, Play, Info } from 'lucide-react';
import { useRouter } from '../../router';
import {
    useSavedWorkouts,
    useUpdateSavedWorkout,
    useDeleteSavedWorkout,
    useCreateSavedWorkout,
} from '../Home/hooks';
import type { SavedWorkoutWithExercises } from '@/apis/saved-workouts/types';
import { ExerciseDetails } from '@/client/components/ExerciseDetails/ExerciseDetails';

export function SavedWorkouts() {
    const { navigate } = useRouter();

    // Queries and mutations
    const { data, isLoading, error } = useSavedWorkouts();
    const updateMutation = useUpdateSavedWorkout();
    const deleteMutation = useDeleteSavedWorkout();
    const duplicateMutation = useCreateSavedWorkout();

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
        });
    };

    const handleViewDetails = (workout: SavedWorkoutWithExercises) => {
        setWorkoutToView(workout);
        setDetailsSheetOpen(true);
    };

    const handleExerciseInfo = (exercise: SavedWorkoutWithExercises['exercises'][0]) => {
        setSelectedExercise(exercise);
        setExerciseDetailsOpen(true);
    };

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

            {/* Details Sheet */}
            <Sheet open={detailsSheetOpen} onOpenChange={setDetailsSheetOpen}>
                <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto">
                    <div className="mx-auto w-12 h-1.5 bg-muted rounded-full mb-4" />
                    <SheetHeader className="text-left">
                        <SheetTitle className="text-xl font-bold">{workoutToView?.name}</SheetTitle>
                    </SheetHeader>
                    <div className="mt-4 space-y-3">
                        {workoutToView?.exercises.map((exercise, index) => (
                            <Card key={index} className="rounded-xl border-0 shadow-sm">
                                <CardContent className="p-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                                            {exercise.exerciseDef.imageUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={exercise.exerciseDef.imageUrl}
                                                    alt={exercise.exerciseDef.name}
                                                    className="w-full h-full object-contain"
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
                        ))}
                    </div>
                    <div className="mt-6 pb-4">
                        <Button
                            onClick={() => setDetailsSheetOpen(false)}
                            className="w-full h-12 rounded-xl"
                        >
                            <Play className="h-4 w-4 mr-2" />
                            Start This Workout
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>

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

