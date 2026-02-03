import { useState } from 'react';
import { Button } from '@/client/components/ui/button';
import { Card, CardContent } from '@/client/components/ui/card';
import { Skeleton } from '@/client/components/ui/skeleton';
import { toast } from '@/client/components/ui/toast';
import { Plus, ArrowUpDown, Bookmark } from 'lucide-react';
import type { PlanExerciseWithDefinition } from '@/apis/plan-exercises/types';
import type { PlanWorkoutClient } from '@/apis/plan-workouts/types';
import { PlanWorkoutList } from './PlanWorkoutList';
import { WorkoutDialog } from './WorkoutDialog';
import { DeleteWorkoutDialog } from './DeleteWorkoutDialog';

interface WorkoutsTabProps {
    planId: string;
    planExercises: PlanExerciseWithDefinition[];
    planWorkouts: PlanWorkoutClient[];
    isLoading: boolean;
    hasData: boolean;
    // Mutations
    createWorkoutMutation: {
        mutate: (
            params: { planId: string; name: string; items: Array<{ planExerciseId: string; order: number; sets?: number }> },
            options?: { onSuccess?: () => void; onError?: (error: Error) => void }
        ) => void;
        isPending: boolean;
    };
    updateWorkoutMutation: {
        mutate: (
            params: { planId: string; workoutId: string; name?: string; items?: Array<{ planExerciseId: string; order: number; sets?: number }> },
            options?: { onSuccess?: () => void; onError?: (error: Error) => void }
        ) => void;
        isPending: boolean;
    };
    deleteWorkoutMutation: {
        mutate: (
            params: { planId: string; workoutId: string },
            options?: { onSuccess?: () => void; onError?: (error: Error) => void }
        ) => void;
        isPending: boolean;
    };
    reorderWorkoutsMutation: {
        mutate: (
            params: { planId: string; workoutIds: string[] },
            options?: { onError?: (error: Error) => void }
        ) => void;
        isPending: boolean;
    };
}

export function WorkoutsTab({
    planId,
    planExercises,
    planWorkouts,
    isLoading,
    hasData,
    createWorkoutMutation,
    updateWorkoutMutation,
    deleteWorkoutMutation,
    reorderWorkoutsMutation,
}: WorkoutsTabProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral mode state
    const [isReorderMode, setIsReorderMode] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral expand state
    const [expandedWorkoutId, setExpandedWorkoutId] = useState<string | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [workoutDialogOpen, setWorkoutDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- null = create mode, workout = edit mode
    const [editingWorkout, setEditingWorkout] = useState<PlanWorkoutClient | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral context
    const [workoutToDelete, setWorkoutToDelete] = useState<PlanWorkoutClient | null>(null);

    const handleOpenWorkoutDialog = (workout?: PlanWorkoutClient) => {
        setEditingWorkout(workout || null);
        setWorkoutDialogOpen(true);
    };

    const handleSaveWorkout = (name: string, items: Array<{ planExerciseId: string; order: number; sets?: number }>) => {
        if (editingWorkout) {
            updateWorkoutMutation.mutate(
                {
                    planId,
                    workoutId: editingWorkout._id,
                    name,
                    items,
                },
                {
                    onSuccess: () => {
                        setWorkoutDialogOpen(false);
                        setEditingWorkout(null);
                        toast.success('Workout updated');
                    },
                    onError: (err) => {
                        toast.error(`Failed to update workout: ${err.message}`);
                    },
                }
            );
        } else {
            createWorkoutMutation.mutate(
                {
                    planId,
                    name,
                    items,
                },
                {
                    onSuccess: () => {
                        setWorkoutDialogOpen(false);
                        toast.success('Workout created');
                    },
                    onError: (err) => {
                        toast.error(`Failed to create workout: ${err.message}`);
                    },
                }
            );
        }
    };

    const handleDeleteWorkoutClick = (workout: PlanWorkoutClient) => {
        setWorkoutToDelete(workout);
        setDeleteDialogOpen(true);
    };

    const confirmDeleteWorkout = () => {
        if (!workoutToDelete) return;
        const workoutId = workoutToDelete._id;

        // Close dialog immediately - optimistic update already removed from list
        setDeleteDialogOpen(false);
        setWorkoutToDelete(null);

        deleteWorkoutMutation.mutate(
            { planId, workoutId },
            {
                onError: (err) => {
                    toast.error(`Failed to delete: ${err.message}`);
                },
            }
        );
    };

    const handleDuplicateWorkout = (workout: PlanWorkoutClient) => {
        createWorkoutMutation.mutate(
            {
                planId,
                name: `${workout.name} (Copy)`,
                items: workout.items.map((item, index) => {
                    // Get exercise to use as fallback for sets
                    const exercise = planExercises.find(pe => pe._id === item.planExerciseId);
                    return {
                        planExerciseId: item.planExerciseId,
                        order: index,
                        // Preserve sets if defined, otherwise use exercise's weekly sets
                        sets: item.sets ?? exercise?.sets,
                    };
                }),
            },
            {
                onSuccess: () => {
                    toast.success('Workout duplicated');
                },
            }
        );
    };

    const handleMoveWorkout = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= planWorkouts.length) return;

        const workoutIds = planWorkouts.map((w) => w._id);
        [workoutIds[index], workoutIds[newIndex]] = [workoutIds[newIndex], workoutIds[index]];

        reorderWorkoutsMutation.mutate(
            { planId, workoutIds },
            {
                onError: (err) => {
                    toast.error(`Failed to reorder: ${err.message}`);
                },
            }
        );
    };

    const handleToggleReorderMode = () => {
        if (!isReorderMode) {
            setExpandedWorkoutId(null);
        }
        setIsReorderMode(!isReorderMode);
    };

    return (
        <div className="space-y-4">
            {/* Create workout button and reorder toggle */}
            <div className="flex gap-2 justify-end">
                {planWorkouts.length > 1 && (
                    <Button
                        variant={isReorderMode ? 'secondary' : 'outline'}
                        size="icon"
                        onClick={handleToggleReorderMode}
                        className="rounded-xl h-10 w-10"
                    >
                        <ArrowUpDown className="h-4 w-4" />
                    </Button>
                )}
                <Button
                    onClick={() => handleOpenWorkoutDialog()}
                    disabled={planExercises.length === 0}
                    className="rounded-xl"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Workout
                </Button>
            </div>

            {/* Workouts list */}
            {isLoading || !hasData ? (
                <div className="space-y-3">
                    {[1, 2].map((i) => (
                        <Card key={i} className="rounded-xl border-0 shadow-sm">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-2">
                                        <Skeleton className="h-5 w-32" />
                                        <Skeleton className="h-4 w-20" />
                                    </div>
                                    <Skeleton className="h-8 w-8 rounded-full" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : planWorkouts.length === 0 ? (
                <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Bookmark className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No saved workouts</h3>
                        <p className="text-sm text-muted-foreground mb-4 text-center">
                            Create a workout from your plan exercises
                        </p>
                        <Button
                            onClick={() => handleOpenWorkoutDialog()}
                            disabled={planExercises.length === 0}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Create Workout
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <PlanWorkoutList
                    workouts={planWorkouts}
                    planExercises={planExercises}
                    expandedWorkoutId={expandedWorkoutId}
                    isReorderMode={isReorderMode}
                    isReorderPending={reorderWorkoutsMutation.isPending}
                    isDuplicatePending={createWorkoutMutation.isPending}
                    onToggleExpand={(workoutId) => setExpandedWorkoutId(expandedWorkoutId === workoutId ? null : workoutId)}
                    onEdit={handleOpenWorkoutDialog}
                    onDuplicate={handleDuplicateWorkout}
                    onDelete={handleDeleteWorkoutClick}
                    onMove={handleMoveWorkout}
                />
            )}

            {/* Dialogs */}
            <WorkoutDialog
                open={workoutDialogOpen}
                onOpenChange={setWorkoutDialogOpen}
                editingWorkout={editingWorkout}
                planExercises={planExercises}
                planWorkouts={planWorkouts}
                onSave={handleSaveWorkout}
                isPending={createWorkoutMutation.isPending || updateWorkoutMutation.isPending}
            />

            <DeleteWorkoutDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                workout={workoutToDelete}
                onConfirm={confirmDeleteWorkout}
            />
        </div>
    );
}
