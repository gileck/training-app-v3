import { useState } from 'react';
import { toast } from '@/client/components/ui/toast';
import { CreateExerciseDialog } from '@/client/components/CreateExerciseDialog';
import type { PlanExerciseWithDefinition } from '@/apis/plan-exercises/types';
import type { ExerciseDefinitionClient } from '@/server/database/collections/exerciseDefinitions/types';
import { useManagePlanStore } from '../../store';
import { AddExerciseDialog } from './AddExerciseDialog';
import { EditExerciseDialog } from './EditExerciseDialog';
import { DeleteExerciseDialog } from './DeleteExerciseDialog';
import { ExercisesToolbar } from './ExercisesToolbar';
import { ExercisesEmptyState } from './ExercisesEmptyState';
import { ExercisesListView } from './ExercisesListView';

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
        const exerciseId = exerciseToDelete._id;

        // Close dialog immediately - optimistic update already removed from list
        setDeleteDialogOpen(false);
        setExerciseToDelete(null);

        deleteExerciseMutation.mutate(
            { planExerciseId: exerciseId },
            {
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
        const exerciseId = exerciseDefToDelete._id;

        // Close dialog immediately - optimistic update already removed from list
        setDeleteExerciseDefDialogOpen(false);
        setExerciseDefToDelete(null);

        deleteExerciseDefMutation.mutate({ exerciseId });
    };

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <ExercisesToolbar
                planExercisesCount={planExercises.length}
                groupBy={planExerciseGroupBy}
                onGroupByChange={setPlanExerciseGroupBy}
                isReorderMode={isReorderMode}
                onToggleReorderMode={() => setIsReorderMode(!isReorderMode)}
                onAddClick={() => setAddDialogOpen(true)}
                isGrouped={!!groupedExercises}
            />

            {/* Exercise list or empty state */}
            {planExercises.length === 0 ? (
                <ExercisesEmptyState onAddClick={() => setAddDialogOpen(true)} />
            ) : (
                <ExercisesListView
                    planExercises={planExercises}
                    groupedExercises={groupedExercises}
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
            />
        </div>
    );
}
