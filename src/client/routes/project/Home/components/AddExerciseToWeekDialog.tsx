import { useState } from 'react';
import { toast } from '@/client/components/template/ui/toast';
import { CreateExerciseDialog } from '@/client/components/project/CreateExerciseDialog';
import type { ExerciseDefinitionClient } from '@/server/database/collections/project/exerciseDefinitions/types';
import {
    useAddPlanExerciseAdapter,
    useBulkAddPlanExercisesAdapter,
} from '@/client/features/project/plan-data';
import {
    useExerciseLibrary,
    useCreateExercise,
    useUpdateExercise,
    useDeleteExercise,
} from '@/client/routes/project/ManagePlan/hooks';
import { AddExerciseDialog } from '@/client/routes/project/ManagePlan/components/exercises/AddExerciseDialog';

interface AddExerciseToWeekDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    planId: string;
    weekNumber: number;
    /** ids of exercise definitions already shown in this week (to mark as added). */
    addedExerciseIds: Set<string>;
}

/**
 * Week-scoped add-exercise flow used on the Home week view.
 *
 * Reuses ManagePlan's AddExerciseDialog but routes every add through the
 * local-first plan-data adapters with `weekNumber` set, so the exercise is
 * scoped to this week only (it won't appear in other weeks). Exercise
 * definition management (create/edit/delete) reuses the same hooks ManagePlan
 * uses so the library stays consistent.
 */
export function AddExerciseToWeekDialog({
    open,
    onOpenChange,
    planId,
    weekNumber,
    addedExerciseIds,
}: AddExerciseToWeekDialogProps) {
    const { data: libraryData, isLoading: isLibraryLoading } = useExerciseLibrary({ enabled: open });
    const exerciseLibrary = libraryData?.exercises || [];

    const addAdapter = useAddPlanExerciseAdapter(planId, exerciseLibrary);
    const bulkAddAdapter = useBulkAddPlanExercisesAdapter(planId, exerciseLibrary);

    const createExerciseMutation = useCreateExercise();
    const updateExerciseMutation = useUpdateExercise();
    const deleteExerciseMutation = useDeleteExercise();

    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [createExerciseOpen, setCreateExerciseOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [editExerciseDefOpen, setEditExerciseDefOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog context
    const [exerciseDefToEdit, setExerciseDefToEdit] = useState<ExerciseDefinitionClient | null>(null);

    const handleAddExercise = (
        exerciseDefId: string,
        config: { sets: number; reps: number; weight: number; comments: string }
    ) => {
        const exerciseName = exerciseLibrary.find((e) => e._id === exerciseDefId)?.name || 'Exercise';
        addAdapter.mutate(
            {
                planId,
                exerciseDefId,
                ...config,
                comments: config.comments || undefined,
                weekNumber,
            },
            {
                onSuccess: () => {
                    onOpenChange(false);
                    toast.success(`"${exerciseName}" added to week ${weekNumber}`);
                },
                onError: (error) => {
                    toast.error(`Failed to add exercise: ${error.message}`);
                },
            }
        );
    };

    const handleBulkAddExercises = (
        exercises: Array<{ exerciseDefId: string; sets: number; reps: number; weight: number; comments?: string }>
    ) => {
        bulkAddAdapter.mutate(
            { planId, exercises, weekNumber },
            {
                onSuccess: (response) => {
                    const addedCount = response?.addedCount || 0;
                    if (addedCount > 0) {
                        onOpenChange(false);
                        toast.success(
                            `${addedCount} exercise${addedCount > 1 ? 's' : ''} added to week ${weekNumber}`
                        );
                    }
                },
                onError: (error) => {
                    toast.error(`Failed to add exercises: ${error.message}`);
                },
            }
        );
    };

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
        updateExerciseMutation.mutate(
            { exerciseId: exerciseDefToEdit._id, ...data },
            {
                onSuccess: () => {
                    setEditExerciseDefOpen(false);
                    setExerciseDefToEdit(null);
                },
            }
        );
    };

    const handleDeleteExerciseDef = (exercise: ExerciseDefinitionClient) => {
        if (addedExerciseIds.has(exercise._id)) {
            toast.error('Cannot delete: This exercise is currently used in this plan. Remove it first.');
            return;
        }
        deleteExerciseMutation.mutate({ exerciseId: exercise._id });
    };

    return (
        <>
            <AddExerciseDialog
                open={open}
                onOpenChange={onOpenChange}
                exerciseLibrary={exerciseLibrary}
                addedExerciseIds={addedExerciseIds}
                isLibraryLoading={isLibraryLoading}
                onAddExercise={handleAddExercise}
                onBulkAddExercises={handleBulkAddExercises}
                isAddPending={addAdapter.isPending}
                isBulkAddPending={bulkAddAdapter.isPending}
                onCreateExercise={() => setCreateExerciseOpen(true)}
                onEditDef={(def) => {
                    setExerciseDefToEdit(def);
                    setEditExerciseDefOpen(true);
                }}
                onDeleteDef={handleDeleteExerciseDef}
            />

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
                isPending={updateExerciseMutation.isPending}
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
        </>
    );
}
