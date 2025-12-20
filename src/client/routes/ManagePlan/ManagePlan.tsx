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
import { ChevronLeft, Plus, Trash2, Edit2, Dumbbell, Search } from 'lucide-react';
import { useRouter } from '../../router';
import {
    usePlan,
    usePlanExercises,
    useExerciseLibrary,
    useAddPlanExercise,
    useUpdatePlanExercise,
    useDeletePlanExercise,
} from './hooks';
import type { PlanExerciseWithDefinition } from '@/apis/plan-exercises/types';
import type { ExerciseDefinitionClient } from '@/server/database/collections/exerciseDefinitions/types';

export function ManagePlan() {
    const { navigate, routeParams } = useRouter();
    const planId = routeParams.planId || '';

    // Queries
    const { data: planData, isLoading: planLoading } = usePlan(planId);
    const { data: exercisesData, isLoading: exercisesLoading } = usePlanExercises(planId);
    const { data: libraryData, isLoading: libraryLoading } = useExerciseLibrary();

    // Mutations - pass libraryData for optimistic updates
    const addExerciseMutation = useAddPlanExercise(libraryData);
    const updateExerciseMutation = useUpdatePlanExercise(planId);
    const deleteExerciseMutation = useDeletePlanExercise(planId);

    // UI state
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral sheet state
    const [addSheetOpen, setAddSheetOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral search filter
    const [searchQuery, setSearchQuery] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral selection state
    const [selectedExercise, setSelectedExercise] = useState<ExerciseDefinitionClient | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [configSets, setConfigSets] = useState(3);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [configReps, setConfigReps] = useState(12);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [configWeight, setConfigWeight] = useState(0);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog context
    const [exerciseToDelete, setExerciseToDelete] = useState<PlanExerciseWithDefinition | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog context
    const [exerciseToEdit, setExerciseToEdit] = useState<PlanExerciseWithDefinition | null>(null);

    const plan = planData?.plan;
    const planExercises = exercisesData?.exercises || [];
    const exerciseLibrary = libraryData?.exercises || [];

    // Filter library by search query and exclude already added exercises
    const addedExerciseIds = new Set(planExercises.map((e) => e.exerciseDefId));
    const filteredLibrary = exerciseLibrary.filter((ex) => {
        if (addedExerciseIds.has(ex._id)) return false;
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            ex.name.toLowerCase().includes(query) ||
            ex.primaryMuscle.toLowerCase().includes(query) ||
            ex.type.toLowerCase().includes(query)
        );
    });

    const handleSelectExercise = (exercise: ExerciseDefinitionClient) => {
        setSelectedExercise(exercise);
        setConfigSets(3);
        setConfigReps(exercise.isStatic ? 0 : 12);
        setConfigWeight(exercise.isBodyweight ? 0 : 20);
    };

    const handleAddExercise = () => {
        if (!selectedExercise) return;

        addExerciseMutation.mutate(
            {
                planId,
                exerciseDefId: selectedExercise._id,
                sets: configSets,
                reps: configReps,
                weight: configWeight,
            },
            {
                onSuccess: () => {
                    setSelectedExercise(null);
                    setAddSheetOpen(false);
                    setSearchQuery('');
                },
            }
        );
    };

    const handleEditExercise = (exercise: PlanExerciseWithDefinition) => {
        setExerciseToEdit(exercise);
        setConfigSets(exercise.sets);
        setConfigReps(exercise.reps);
        setConfigWeight(exercise.weight);
        setEditDialogOpen(true);
    };

    const handleSaveEdit = () => {
        if (!exerciseToEdit) return;

        updateExerciseMutation.mutate(
            {
                planExerciseId: exerciseToEdit._id,
                sets: configSets,
                reps: configReps,
                weight: configWeight,
            },
            {
                onSuccess: () => {
                    setEditDialogOpen(false);
                    setExerciseToEdit(null);
                },
            }
        );
    };

    const handleDeleteExercise = (exercise: PlanExerciseWithDefinition) => {
        setExerciseToDelete(exercise);
        setDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (!exerciseToDelete) return;

        deleteExerciseMutation.mutate(
            { planExerciseId: exerciseToDelete._id },
            {
                onSuccess: () => {
                    setDeleteDialogOpen(false);
                    setExerciseToDelete(null);
                },
            }
        );
    };

    const isLoading = planLoading || exercisesLoading;

    // Loading state
    if (isLoading && !plan) {
        return (
            <div className="p-4 pb-20 space-y-4">
                <div className="flex items-center gap-3 mb-4">
                    <Skeleton className="h-10 w-10" />
                    <Skeleton className="h-6 w-48" />
                </div>
                {[1, 2, 3].map((i) => (
                    <Card key={i} className="rounded-xl">
                        <CardContent className="p-3 flex items-center gap-3">
                            <Skeleton className="h-16 w-16 rounded-lg" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-5 w-32" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    if (!plan) {
        return (
            <div className="p-4 pb-20">
                <Button
                    variant="ghost"
                    onClick={() => navigate('/training-plans')}
                    className="mb-4"
                >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
                <Card className="rounded-2xl border-destructive bg-destructive/10 p-4">
                    <p className="text-destructive">Plan not found</p>
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
                    onClick={() => navigate('/training-plans')}
                    className="rounded-full"
                >
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-xl font-semibold">{plan.name}</h1>
                    <p className="text-sm text-muted-foreground">{plan.durationWeeks} weeks</p>
                </div>
                <Button onClick={() => setAddSheetOpen(true)} className="rounded-xl">
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                </Button>
            </div>

            {/* Exercise list */}
            {planExercises.length === 0 ? (
                <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Dumbbell className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No exercises yet</h3>
                        <p className="text-sm text-muted-foreground mb-4 text-center">
                            Add exercises from the library to build your plan
                        </p>
                        <Button onClick={() => setAddSheetOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Exercise
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {planExercises.map((exercise) => (
                        <Card
                            key={exercise._id}
                            className="rounded-xl border-0 shadow-sm active:scale-[0.98] transition-transform"
                        >
                            <CardContent className="p-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                                        {exercise.exerciseDef.imageUrl ? (
                                            <img
                                                src={exercise.exerciseDef.imageUrl}
                                                alt={exercise.exerciseDef.name}
                                                className="w-full h-full object-contain"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Dumbbell className="h-6 w-6 text-muted-foreground" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold truncate">
                                            {exercise.exerciseDef.name}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            {exercise.sets} sets × {exercise.reps} reps
                                            {exercise.weight > 0 && ` • ${exercise.weight}kg`}
                                        </p>
                                        <Badge
                                            variant="outline"
                                            className="mt-1 text-xs bg-[hsl(210,100%,95%)] text-[hsl(210,100%,40%)] border-[hsl(210,100%,85%)] dark:bg-[hsl(210,100%,20%)] dark:text-[hsl(210,100%,80%)]"
                                        >
                                            {exercise.exerciseDef.primaryMuscle}
                                        </Badge>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleEditExercise(exercise)}
                                            className="h-9 w-9 rounded-full"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteExercise(exercise)}
                                            className="h-9 w-9 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Add Exercise Sheet */}
            <Sheet open={addSheetOpen} onOpenChange={setAddSheetOpen}>
                <SheetContent side="bottom" className="rounded-t-3xl h-[85vh] px-5">
                    <div className="mx-auto w-12 h-1.5 bg-muted rounded-full mb-4" />
                    <SheetHeader className="mb-6">
                        <SheetTitle className="text-xl">
                            {selectedExercise ? 'Configure Exercise' : 'Add Exercise'}
                        </SheetTitle>
                    </SheetHeader>

                    {selectedExercise ? (
                        /* Exercise configuration */
                        <div className="space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden flex-shrink-0">
                                    {selectedExercise.imageUrl ? (
                                        <img
                                            src={selectedExercise.imageUrl}
                                            alt={selectedExercise.name}
                                            className="w-full h-full object-contain"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Dumbbell className="h-8 w-8 text-muted-foreground" />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg">{selectedExercise.name}</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {selectedExercise.primaryMuscle} • {selectedExercise.type}
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
                                            onClick={() => setConfigSets((s) => Math.max(1, s - 1))}
                                            className="h-11 w-11 rounded-lg"
                                        >
                                            -
                                        </Button>
                                        <span className="w-12 text-center font-semibold text-xl">
                                            {configSets}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setConfigSets((s) => Math.min(10, s + 1))}
                                            className="h-11 w-11 rounded-lg"
                                        >
                                            +
                                        </Button>
                                    </div>
                                </div>

                                {!selectedExercise.isStatic && (
                                    <div className="grid gap-2">
                                        <Label>Reps</Label>
                                        <div className="flex items-center gap-3">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => setConfigReps((r) => Math.max(1, r - 1))}
                                                className="h-11 w-11 rounded-lg"
                                            >
                                                -
                                            </Button>
                                            <span className="w-12 text-center font-semibold text-xl">
                                                {configReps}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => setConfigReps((r) => Math.min(50, r + 1))}
                                                className="h-11 w-11 rounded-lg"
                                            >
                                                +
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {!selectedExercise.isBodyweight && (
                                    <div className="grid gap-2">
                                        <Label>Weight (kg)</Label>
                                        <Input
                                            type="number"
                                            value={configWeight}
                                            onChange={(e) => setConfigWeight(Number(e.target.value))}
                                            className="rounded-lg"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 mt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => setSelectedExercise(null)}
                                    className="flex-1 h-12 rounded-xl"
                                >
                                    Back
                                </Button>
                                <Button
                                    onClick={handleAddExercise}
                                    disabled={addExerciseMutation.isPending}
                                    className="flex-1 h-12 rounded-xl"
                                >
                                    {addExerciseMutation.isPending ? 'Adding...' : 'Add to Plan'}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        /* Exercise library browser */
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search exercises..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 rounded-xl"
                                />
                            </div>

                            <div className="h-[55vh] overflow-y-auto">
                                {libraryLoading ? (
                                    <div className="divide-y divide-border">
                                        {[1, 2, 3, 4, 5].map((i) => (
                                            <div key={i} className="flex items-center gap-4 py-3">
                                                <Skeleton className="h-14 w-14 rounded-lg" />
                                                <div className="space-y-2">
                                                    <Skeleton className="h-4 w-32" />
                                                    <Skeleton className="h-3 w-24" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : filteredLibrary.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        {searchQuery
                                            ? 'No exercises match your search'
                                            : 'All exercises are already in your plan'}
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border/50">
                                        {filteredLibrary.map((exercise) => (
                                            <button
                                                key={exercise._id}
                                                onClick={() => handleSelectExercise(exercise)}
                                                className="w-full flex items-center gap-4 py-3.5 hover:bg-muted/50 active:scale-[0.99] transition-all text-left"
                                            >
                                                <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                                                    {exercise.imageUrl ? (
                                                        <img
                                                            src={exercise.imageUrl}
                                                            alt={exercise.name}
                                                            className="w-full h-full object-contain"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Dumbbell className="h-6 w-6 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-[15px] truncate">{exercise.name}</p>
                                                    <p className="text-sm text-muted-foreground mt-0.5">
                                                        {exercise.primaryMuscle} • {exercise.type}
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            {/* Edit Exercise Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit Exercise</DialogTitle>
                    </DialogHeader>
                    {exerciseToEdit && (
                        <div className="space-y-4 py-4">
                            <p className="font-medium">{exerciseToEdit.exerciseDef.name}</p>

                            <div className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label>Sets</Label>
                                    <div className="flex items-center gap-3">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setConfigSets((s) => Math.max(1, s - 1))}
                                            className="h-10 w-10 rounded-lg"
                                        >
                                            -
                                        </Button>
                                        <span className="w-12 text-center font-semibold">
                                            {configSets}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setConfigSets((s) => Math.min(10, s + 1))}
                                            className="h-10 w-10 rounded-lg"
                                        >
                                            +
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label>Reps</Label>
                                    <div className="flex items-center gap-3">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setConfigReps((r) => Math.max(1, r - 1))}
                                            className="h-10 w-10 rounded-lg"
                                        >
                                            -
                                        </Button>
                                        <span className="w-12 text-center font-semibold">
                                            {configReps}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setConfigReps((r) => Math.min(50, r + 1))}
                                            className="h-10 w-10 rounded-lg"
                                        >
                                            +
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label>Weight (kg)</Label>
                                    <Input
                                        type="number"
                                        value={configWeight}
                                        onChange={(e) => setConfigWeight(Number(e.target.value))}
                                        className="rounded-lg"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
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
                            disabled={updateExerciseMutation.isPending}
                            className="rounded-lg"
                        >
                            {updateExerciseMutation.isPending ? 'Saving...' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Remove Exercise?</DialogTitle>
                        <DialogDescription>
                            This will remove &quot;{exerciseToDelete?.exerciseDef.name}&quot; from
                            your plan and delete all progress data for this exercise.
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
                            disabled={deleteExerciseMutation.isPending}
                            className="rounded-lg"
                        >
                            {deleteExerciseMutation.isPending ? 'Removing...' : 'Remove'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

