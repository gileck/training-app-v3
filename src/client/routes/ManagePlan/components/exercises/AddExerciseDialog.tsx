import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@/client/components/ui/dialog';
import type { ExerciseDefinitionClient } from '@/server/database/collections/exerciseDefinitions/types';
import type { MultiSelectExerciseConfig } from '../../types';
import { ExerciseLibraryBrowser } from './ExerciseLibraryBrowser';
import { ExerciseConfigForm } from './ExerciseConfigForm';
import { MultiConfigDialog } from './MultiConfigDialog';

interface AddExerciseDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    exerciseLibrary: ExerciseDefinitionClient[];
    addedExerciseIds: Set<string>;
    isLibraryLoading: boolean;
    onAddExercise: (exerciseDefId: string, config: { sets: number; reps: number; weight: number; comments: string }) => void;
    onBulkAddExercises: (exercises: Array<{ exerciseDefId: string; sets: number; reps: number; weight: number; comments?: string }>) => void;
    isAddPending: boolean;
    isBulkAddPending: boolean;
    onCreateExercise: () => void;
    onEditDef: (exercise: ExerciseDefinitionClient) => void;
    onDeleteDef: (exercise: ExerciseDefinitionClient) => void;
}

export function AddExerciseDialog({
    open,
    onOpenChange,
    exerciseLibrary,
    addedExerciseIds,
    isLibraryLoading,
    onAddExercise,
    onBulkAddExercises,
    isAddPending,
    isBulkAddPending,
    onCreateExercise,
    onEditDef,
    onDeleteDef,
}: AddExerciseDialogProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral selection state
    const [selectedExercise, setSelectedExercise] = useState<ExerciseDefinitionClient | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral multi-select state
    const [selectedExercises, setSelectedExercises] = useState<Map<string, MultiSelectExerciseConfig>>(new Map());
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral multi-config view
    const [showMultiConfig, setShowMultiConfig] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dismiss state
    const [showCreateExerciseBanner, setShowCreateExerciseBanner] = useState(true);

    const handleSelectExercise = (exercise: ExerciseDefinitionClient) => {
        setSelectedExercise(exercise);
    };

    const handleToggleMultiSelect = (exercise: ExerciseDefinitionClient) => {
        setSelectedExercises((prev) => {
            const newMap = new Map(prev);
            if (newMap.has(exercise._id)) {
                newMap.delete(exercise._id);
            } else {
                newMap.set(exercise._id, {
                    exercise,
                    sets: 3,
                    reps: exercise.isStatic ? 0 : 12,
                    weight: exercise.isBodyweight ? 0 : 20,
                    comments: '',
                });
            }
            return newMap;
        });
    };

    const handleUpdateMultiConfig = (exerciseId: string, field: 'sets' | 'reps' | 'weight' | 'comments', value: number | string) => {
        setSelectedExercises((prev) => {
            const newMap = new Map(prev);
            const item = newMap.get(exerciseId);
            if (item) {
                newMap.set(exerciseId, { ...item, [field]: value });
            }
            return newMap;
        });
    };

    const handleRemoveFromMultiSelect = (exerciseId: string) => {
        setSelectedExercises((prev) => {
            const newMap = new Map(prev);
            newMap.delete(exerciseId);
            return newMap;
        });
        if (selectedExercises.size <= 1) {
            setShowMultiConfig(false);
        }
    };

    const handleCancelMultiSelect = () => {
        setSelectedExercises(new Map());
        setShowMultiConfig(false);
    };

    const handleAddSingleExercise = (config: { sets: number; reps: number; weight: number; comments: string }) => {
        if (!selectedExercise) return;
        onAddExercise(selectedExercise._id, config);
        // Don't reset selectedExercise here - the dialog closing via handleOpenChange 
        // will reset all state. Resetting here causes a flash of "Add Exercise" view.
    };

    const handleAddAllExercises = () => {
        const exercises = Array.from(selectedExercises.values()).map((item) => ({
            exerciseDefId: item.exercise._id,
            sets: item.sets,
            reps: item.reps,
            weight: item.weight,
            comments: item.comments.trim() || undefined,
        }));
        onBulkAddExercises(exercises);
        // Reset state after successful add
        setSelectedExercises(new Map());
        setShowMultiConfig(false);
    };

    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) {
            // Reset state when closing
            setSelectedExercise(null);
            setSelectedExercises(new Map());
            setShowMultiConfig(false);
        }
        onOpenChange(newOpen);
    };

    return (
        <>
            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent className="w-[calc(100%-32px)] max-w-lg h-[calc(100vh-120px)] max-h-[700px] rounded-2xl p-0 gap-0 flex flex-col">
                    {/* Header */}
                    <div className="px-5 pt-5 pb-4 border-b shrink-0">
                        <DialogTitle className="text-lg font-semibold">
                            {selectedExercise ? 'Configure Exercise' : 'Add Exercise'}
                        </DialogTitle>
                    </div>

                    {selectedExercise ? (
                        <ExerciseConfigForm
                            exercise={selectedExercise}
                            onSubmit={handleAddSingleExercise}
                            onBack={() => setSelectedExercise(null)}
                            isPending={isAddPending}
                        />
                    ) : (
                        <ExerciseLibraryBrowser
                            exerciseLibrary={exerciseLibrary}
                            addedExerciseIds={addedExerciseIds}
                            isLoading={isLibraryLoading}
                            showCreateExerciseBanner={showCreateExerciseBanner}
                            onDismissBanner={() => setShowCreateExerciseBanner(false)}
                            onCreateExercise={onCreateExercise}
                            onSelectExercise={handleSelectExercise}
                            onEditDef={onEditDef}
                            onDeleteDef={onDeleteDef}
                            selectedExercises={selectedExercises}
                            onToggleMultiSelect={handleToggleMultiSelect}
                            onShowMultiConfig={() => setShowMultiConfig(true)}
                            onCancelMultiSelect={handleCancelMultiSelect}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <MultiConfigDialog
                open={showMultiConfig}
                onOpenChange={setShowMultiConfig}
                selectedExercises={selectedExercises}
                onUpdateConfig={handleUpdateMultiConfig}
                onRemove={handleRemoveFromMultiSelect}
                onSubmit={handleAddAllExercises}
                isPending={isBulkAddPending}
            />
        </>
    );
}
