import { useState } from 'react';
import { Button } from '@/client/components/ui/button';
import { Card, CardContent } from '@/client/components/ui/card';
import { toast } from '@/client/components/ui/toast';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/client/components/ui/select';
import { Plus, ArrowUpDown, Dumbbell } from 'lucide-react';
import { CreateExerciseDialog } from '@/client/components/CreateExerciseDialog';
import type { PlanExerciseWithDefinition } from '@/apis/plan-exercises/types';
import type { ExerciseDefinitionClient } from '@/server/database/collections/exerciseDefinitions/types';
import { useManagePlanStore, type PlanExerciseGroupBy } from '../../store';
import { PlanExerciseList } from './PlanExerciseList';
import { AddExerciseDialog } from './AddExerciseDialog';
import { EditExerciseDialog } from './EditExerciseDialog';
import { DeleteExerciseDialog } from './DeleteExerciseDialog';

interface ExercisesTabProps {
    planId: string;
    planExercises: PlanExerciseWithDefinition[];
    exerciseLibrary: ExerciseDefinitionClient[];
    isLibraryLoading: boolean;
    // Mutations
    addExerciseMutation: {
        mutate: (params: { planId: string; exerciseDefId: string; sets: number; reps: number; weight: number; comments?: string }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void;
        isPending: boolean;
    };
    bulkAddMutation: {
        mutate: (params: { planId: string; exercises: Array<{ exerciseDefId: string; sets: number; reps: number; weight: number; comments?: string }> }, options?: { onSuccess?: (response?: { addedCount?: number; failedCount?: number; results?: Array<{ error?: string }> }) => void; onError?: (error: Error) => void }) => void;
        isPending: boolean;
    };
    updateExerciseMutation: {
        mutate: (params: { planExerciseId: string; sets: number; reps: number; weight: number; comments?: string }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void;
        isPending: boolean;
    };
    deleteExerciseMutation: {
        mutate: (params: { planExerciseId: string }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void;
        isPending: boolean;
    };
    reorderMutation: {
        mutate: (params: { planId: string; exerciseIds: string[] }) => void;
        isPending: boolean;
    };
    createExerciseMutation: {
        mutate: (data: { name: string; imageBase64?: string; primaryMuscle: string; secondaryMuscles: string[]; type: string; isBodyweight: boolean; isStatic: boolean }, options?: { onSuccess?: (exercise?: ExerciseDefinitionClient) => void; onError?: (error: Error) => void }) => void;
        isPending: boolean;
    };
    updateExerciseDefMutation: {
        mutate: (data: { exerciseId: string; name: string; imageBase64?: string; primaryMuscle: string; secondaryMuscles: string[]; type: string; isBodyweight: boolean; isStatic: boolean }, options?: { onSuccess?: () => void }) => void;
        isPending: boolean;
    };
    deleteExerciseDefMutation: {
        mutate: (params: { exerciseId: string }, options?: { onSuccess?: () => void }) => void;
        isPending: boolean;
    };
    onExerciseAdded: (message: string) => void;
}

export function ExercisesTab({
    planId,
    planExercises,
    exerciseLibrary,
    isLibraryLoading,
    addExerciseMutation,
    bulkAddMutation,
    updateExerciseMutation,
    deleteExerciseMutation,
    reorderMutation,
    createExerciseMutation,
    updateExerciseDefMutation,
    deleteExerciseDefMutation,
    onExerciseAdded,
}: ExercisesTabProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral mode state
    const [isReorderMode, setIsReorderMode] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog context
    const [exerciseToEdit, setExerciseToEdit] = useState<PlanExerciseWithDefinition | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog context
    const [exerciseToDelete, setExerciseToDelete] = useState<PlanExerciseWithDefinition | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [createExerciseOpen, setCreateExerciseOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [editExerciseDefOpen, setEditExerciseDefOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog context
    const [exerciseDefToEdit, setExerciseDefToEdit] = useState<ExerciseDefinitionClient | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [deleteExerciseDefDialogOpen, setDeleteExerciseDefDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog context
    const [exerciseDefToDelete, setExerciseDefToDelete] = useState<ExerciseDefinitionClient | null>(null);

    const addedExerciseIds = new Set(planExercises.map((e) => e.exerciseDefId));

    // Group by state from store
    const planExerciseGroupBy = useManagePlanStore((state) => state.planExerciseGroupBy);
    const setPlanExerciseGroupBy = useManagePlanStore((state) => state.setPlanExerciseGroupBy);

    // Group exercises if groupBy is set
    const groupedExercises = (() => {
        if (planExerciseGroupBy === 'none') {
            return null;
        }
        const groups: Record<string, PlanExerciseWithDefinition[]> = {};
        planExercises.forEach((ex) => {
            const key = ex.exerciseDef[planExerciseGroupBy] || 'Other';
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(ex);
        });
        // Sort groups by count (descending)
        return Object.entries(groups).sort(([, a], [, b]) => b.length - a.length);
    })();

    const handleAddExercise = (exerciseDefId: string, config: { sets: number; reps: number; weight: number; comments: string }) => {
        const exerciseName = exerciseLibrary.find((e) => e._id === exerciseDefId)?.name || 'Exercise';
        addExerciseMutation.mutate(
            { planId, exerciseDefId, ...config, comments: config.comments || undefined },
            {
                onSuccess: () => {
                    setAddDialogOpen(false);
                    onExerciseAdded(`"${exerciseName}" added to plan`);
                },
                onError: (error) => {
                    toast.error(`Failed to add exercise: ${error.message}`);
                },
            }
        );
    };

    const handleBulkAddExercises = (exercises: Array<{ exerciseDefId: string; sets: number; reps: number; weight: number; comments?: string }>) => {
        bulkAddMutation.mutate(
            { planId, exercises },
            {
                onSuccess: (response) => {
                    const addedCount = response?.addedCount || 0;
                    const failedCount = response?.failedCount || 0;

                    if (addedCount > 0) {
                        let message = `${addedCount} exercise${addedCount > 1 ? 's' : ''} added to plan`;
                        if (failedCount > 0) {
                            message += ` (${failedCount} failed)`;
                        }
                        setAddDialogOpen(false);
                        onExerciseAdded(message);
                    } else if (failedCount > 0) {
                        const errors = response?.results
                            ?.filter((r) => r.error)
                            .map((r) => r.error)
                            .join(', ');
                        toast.error(`Failed to add exercises: ${errors}`);
                    }
                },
                onError: (error) => {
                    toast.error(`Failed to add exercises: ${error.message}`);
                },
            }
        );
    };

    const handleEditExercise = (exercise: PlanExerciseWithDefinition) => {
        setExerciseToEdit(exercise);
        setEditDialogOpen(true);
    };

    const handleSaveEdit = (config: { sets: number; reps: number; weight: number; comments: string }) => {
        if (!exerciseToEdit) return;
        updateExerciseMutation.mutate(
            { planExerciseId: exerciseToEdit._id, ...config, comments: config.comments || undefined },
            {
                onSuccess: () => {
                    setEditDialogOpen(false);
                    setExerciseToEdit(null);
                },
                onError: (error) => {
                    toast.error(`Failed to update exercise: ${error.message}`);
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
                onError: (error) => {
                    toast.error(`Failed to delete exercise: ${error.message}`);
                },
            }
        );
    };

    const handleMoveExercise = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= planExercises.length) return;

        const newOrder = [...planExercises];
        const [moved] = newOrder.splice(index, 1);
        newOrder.splice(newIndex, 0, moved);

        const exerciseIds = newOrder.map((ex) => ex._id);
        reorderMutation.mutate({ planId, exerciseIds });
    };

    // Custom exercise handlers
    const handleCreateCustomExercise = (data: {
        name: string;
        imageBase64?: string;
        primaryMuscle: string;
        secondaryMuscles: string[];
        type: string;
        isBodyweight: boolean;
        isStatic: boolean;
    }) => {
        createExerciseMutation.mutate(data, {
            onSuccess: () => {
                setCreateExerciseOpen(false);
            },
            onError: (error) => {
                toast.error(`Failed to create exercise: ${error.message}`);
            },
        });
    };

    const handleEditExerciseDef = (exercise: ExerciseDefinitionClient) => {
        setExerciseDefToEdit(exercise);
        setEditExerciseDefOpen(true);
    };

    const handleUpdateExerciseDef = (data: {
        name: string;
        imageBase64?: string;
        primaryMuscle: string;
        secondaryMuscles: string[];
        type: string;
        isBodyweight: boolean;
        isStatic: boolean;
    }) => {
        if (!exerciseDefToEdit) return;
        updateExerciseDefMutation.mutate(
            { exerciseId: exerciseDefToEdit._id, ...data },
            {
                onSuccess: () => {
                    setEditExerciseDefOpen(false);
                    setExerciseDefToEdit(null);
                },
            }
        );
    };

    const handleDeleteExerciseDefClick = (exercise: ExerciseDefinitionClient) => {
        const isInPlan = planExercises.some((pe) => pe.exerciseDefId === exercise._id);
        if (isInPlan) {
            toast.error('Cannot delete: This exercise is currently used in this plan. Remove it from the plan first.');
            return;
        }
        setExerciseDefToDelete(exercise);
        setDeleteExerciseDefDialogOpen(true);
    };

    const confirmDeleteExerciseDef = () => {
        if (!exerciseDefToDelete) return;
        deleteExerciseDefMutation.mutate(
            { exerciseId: exerciseDefToDelete._id },
            {
                onSuccess: () => {
                    setDeleteExerciseDefDialogOpen(false);
                    setExerciseDefToDelete(null);
                },
            }
        );
    };

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex gap-2 justify-between items-center">
                {/* Group By dropdown */}
                <div className="flex items-center gap-2">
                    {planExercises.length > 0 && (
                        <Select
                            value={planExerciseGroupBy}
                            onValueChange={(v) => setPlanExerciseGroupBy(v as PlanExerciseGroupBy)}
                        >
                            <SelectTrigger className="w-[140px] h-10 rounded-xl text-sm">
                                <SelectValue placeholder="Group by" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">List All</SelectItem>
                                <SelectItem value="primaryMuscle">By Muscle</SelectItem>
                                <SelectItem value="type">By Type</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                </div>
                {/* Add/Reorder buttons */}
                <div className="flex gap-2">
                    {planExercises.length > 1 && (
                        <Button
                            variant={isReorderMode ? 'secondary' : 'outline'}
                            size="icon"
                            onClick={() => setIsReorderMode(!isReorderMode)}
                            className="rounded-xl h-10 w-10"
                            disabled={!!groupedExercises}
                        >
                            <ArrowUpDown className="h-4 w-4" />
                        </Button>
                    )}
                    <Button onClick={() => setAddDialogOpen(true)} className="rounded-xl">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Exercise
                    </Button>
                </div>
            </div>

            {/* Exercise list or empty state */}
            {planExercises.length === 0 ? (
                <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Dumbbell className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No exercises yet</h3>
                        <p className="text-sm text-muted-foreground mb-4 text-center">
                            Add exercises from the library to build your plan
                        </p>
                        <Button onClick={() => setAddDialogOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Exercise
                        </Button>
                    </CardContent>
                </Card>
            ) : groupedExercises ? (
                <div className="space-y-6">
                    {groupedExercises.map(([groupName, exercises]) => {
                        const totalSets = exercises.reduce((sum, ex) => sum + ex.sets, 0);
                        return (
                            <div key={groupName}>
                                <div className="py-2 mb-2 border-b border-border flex items-center gap-2">
                                    <h3 className="font-semibold text-sm text-foreground">
                                        {groupName}
                                    </h3>
                                    <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-muted text-xs font-medium text-muted-foreground">
                                        {exercises.length}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        · {totalSets} sets
                                    </span>
                                </div>
                                <PlanExerciseList
                                    exercises={exercises}
                                    isReorderMode={false}
                                    isReorderPending={false}
                                    onEdit={handleEditExercise}
                                    onDelete={handleDeleteExercise}
                                    onMove={() => {}}
                                />
                            </div>
                        );
                    })}
                </div>
            ) : (
                <PlanExerciseList
                    exercises={planExercises}
                    isReorderMode={isReorderMode}
                    isReorderPending={reorderMutation.isPending}
                    onEdit={handleEditExercise}
                    onDelete={handleDeleteExercise}
                    onMove={handleMoveExercise}
                />
            )}

            {/* Dialogs */}
            <AddExerciseDialog
                open={addDialogOpen}
                onOpenChange={setAddDialogOpen}
                exerciseLibrary={exerciseLibrary}
                addedExerciseIds={addedExerciseIds}
                isLibraryLoading={isLibraryLoading}
                onAddExercise={handleAddExercise}
                onBulkAddExercises={handleBulkAddExercises}
                isAddPending={addExerciseMutation.isPending}
                isBulkAddPending={bulkAddMutation.isPending}
                onCreateExercise={() => setCreateExerciseOpen(true)}
                onEditDef={handleEditExerciseDef}
                onDeleteDef={handleDeleteExerciseDefClick}
            />

            <EditExerciseDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                exercise={exerciseToEdit}
                onSave={handleSaveEdit}
                isPending={updateExerciseMutation.isPending}
            />

            <DeleteExerciseDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                exercise={exerciseToDelete}
                onConfirm={confirmDelete}
                isPending={deleteExerciseMutation.isPending}
            />

            {/* Custom Exercise Dialogs */}
            <CreateExerciseDialog
                open={createExerciseOpen}
                onOpenChange={setCreateExerciseOpen}
                onSubmit={handleCreateCustomExercise}
                isPending={createExerciseMutation.isPending}
            />

            <CreateExerciseDialog
                open={editExerciseDefOpen}
                onOpenChange={setEditExerciseDefOpen}
                onSubmit={handleUpdateExerciseDef}
                isPending={updateExerciseDefMutation.isPending}
                editMode
                initialData={exerciseDefToEdit ? {
                    name: exerciseDefToEdit.name,
                    imageUrl: exerciseDefToEdit.imageUrl,
                    primaryMuscle: exerciseDefToEdit.primaryMuscle,
                    secondaryMuscles: exerciseDefToEdit.secondaryMuscles,
                    type: exerciseDefToEdit.type,
                    isBodyweight: exerciseDefToEdit.isBodyweight,
                    isStatic: exerciseDefToEdit.isStatic,
                } : undefined}
            />

            <DeleteExerciseDialog
                open={deleteExerciseDefDialogOpen}
                onOpenChange={setDeleteExerciseDefDialogOpen}
                exercise={exerciseDefToDelete ? { exerciseDef: exerciseDefToDelete } as PlanExerciseWithDefinition : null}
                onConfirm={confirmDeleteExerciseDef}
                isPending={deleteExerciseDefMutation.isPending}
            />
        </div>
    );
}
