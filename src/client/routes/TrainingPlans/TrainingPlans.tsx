import { useState } from 'react';
import { Button } from '@/client/components/ui/button';
import { Card, CardContent } from '@/client/components/ui/card';
import { Input } from '@/client/components/ui/input';
import { Label } from '@/client/components/ui/label';
import { Badge } from '@/client/components/ui/badge';
import { Skeleton } from '@/client/components/ui/skeleton';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/client/components/ui/dialog';
import { Plus, Calendar, Trash2, Settings2, CheckCircle, Copy, Edit2 } from 'lucide-react';
import { usePlans, useCreatePlan, useUpdatePlan, useDeletePlan, useSetActivePlan, useDuplicatePlan } from './hooks';
import { useWorkoutStore } from '@/client/features/workout';
import { useTrainingPlansStore } from './store';
import { ManagePlan } from '../ManagePlan';
import type { TrainingPlanClient } from '@/server/database/collections/trainingPlans/types';

export function TrainingPlans() {
    // Queries and mutations
    const { data, error } = usePlans();
    const createPlanMutation = useCreatePlan();
    const updatePlanMutation = useUpdatePlan();
    const deletePlanMutation = useDeletePlan();
    const setActivePlanMutation = useSetActivePlan();
    const duplicatePlanMutation = useDuplicatePlan();

    // Workout store for syncing active plan
    const setActivePlan = useWorkoutStore((state) => state.setActivePlan);
    
    // Route-level store for persisting selected plan
    const selectedPlanId = useTrainingPlansStore((state) => state.selectedPlanId);
    const setSelectedPlanId = useTrainingPlansStore((state) => state.setSelectedPlanId);

    // Local UI state
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
    const [newPlanName, setNewPlanName] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
    const [newPlanWeeks, setNewPlanWeeks] = useState(8);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog context
    const [planToDelete, setPlanToDelete] = useState<TrainingPlanClient | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog context
    const [planToEdit, setPlanToEdit] = useState<TrainingPlanClient | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
    const [editPlanName, setEditPlanName] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
    const [editPlanWeeks, setEditPlanWeeks] = useState(8);

    const plans = data?.plans || [];
    const hasData = data !== undefined;

    const handleCreatePlan = async () => {
        if (!newPlanName.trim()) return;

        createPlanMutation.mutate(
            { name: newPlanName.trim(), durationWeeks: newPlanWeeks },
            {
                onSuccess: (newPlan) => {
                    setCreateDialogOpen(false);
                    setNewPlanName('');
                    setNewPlanWeeks(8);
                    // If this is the first plan, set it as active in store
                    if (newPlan && plans.length === 0) {
                        setActivePlan(newPlan._id);
                    }
                },
            }
        );
    };

    const handleDeletePlan = (plan: TrainingPlanClient) => {
        setPlanToDelete(plan);
        setDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (!planToDelete) return;

        deletePlanMutation.mutate(
            { planId: planToDelete._id },
            {
                onSuccess: () => {
                    setDeleteDialogOpen(false);
                    setPlanToDelete(null);
                    // Clear selection if the deleted plan was selected
                    if (selectedPlanId === planToDelete._id) {
                        setSelectedPlanId(null);
                    }
                },
            }
        );
    };

    const handleSetActive = (plan: TrainingPlanClient) => {
        setActivePlanMutation.mutate(
            { planId: plan._id },
            {
                onSuccess: () => {
                    setActivePlan(plan._id);
                },
            }
        );
    };

    const handleManagePlan = (plan: TrainingPlanClient) => {
        setSelectedPlanId(plan._id);
    };
    
    const handleBackFromManage = () => {
        setSelectedPlanId(null);
    };

    const handleEditPlan = (plan: TrainingPlanClient) => {
        setPlanToEdit(plan);
        setEditPlanName(plan.name);
        setEditPlanWeeks(plan.durationWeeks);
        setEditDialogOpen(true);
    };

    const confirmEdit = () => {
        if (!planToEdit || !editPlanName.trim()) return;

        updatePlanMutation.mutate(
            {
                planId: planToEdit._id,
                name: editPlanName.trim(),
                durationWeeks: editPlanWeeks,
            },
            {
                onSuccess: () => {
                    setEditDialogOpen(false);
                    setPlanToEdit(null);
                },
            }
        );
    };

    const handleDuplicatePlan = (plan: TrainingPlanClient) => {
        duplicatePlanMutation.mutate({ planId: plan._id });
    };

    // Loading state - show skeleton when loading without cached data
    if (!hasData) {
        return (
            <div className="p-4 pb-20 space-y-4">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-xl font-semibold">Training Plans</h1>
                    <Skeleton className="h-10 w-32" />
                </div>
                {[1, 2, 3].map((i) => (
                    <Card key={i} className="rounded-2xl border-0 shadow-sm">
                        <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-3">
                                <div className="space-y-2">
                                    <Skeleton className="h-6 w-48" />
                                    <Skeleton className="h-4 w-32" />
                                </div>
                                <Skeleton className="h-6 w-16" />
                            </div>
                            <div className="flex gap-2">
                                <Skeleton className="h-9 w-24" />
                                <Skeleton className="h-9 w-24" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="p-4 pb-20">
                <h1 className="text-xl font-semibold mb-4">Training Plans</h1>
                <Card className="rounded-2xl border-destructive bg-destructive/10 p-4">
                    <p className="text-destructive">
                        Failed to load plans: {error instanceof Error ? error.message : 'Unknown error'}
                    </p>
                </Card>
            </div>
        );
    }
    
    // If a plan is selected, show the manage view
    if (selectedPlanId) {
        return (
            <ManagePlan
                planId={selectedPlanId}
                onBack={handleBackFromManage}
            />
        );
    }

    return (
        <div className="p-4 pb-20 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <h1 className="text-xl font-semibold">Training Plans</h1>
                <Button
                    onClick={() => setCreateDialogOpen(true)}
                    className="rounded-xl"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    New Plan
                </Button>
            </div>

            {/* Empty state */}
            {plans.length === 0 ? (
                <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No training plans yet</h3>
                        <p className="text-sm text-muted-foreground mb-4 text-center">
                            Create a training plan to start tracking your workouts
                        </p>
                        <Button onClick={() => setCreateDialogOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Create Plan
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                /* Plan list */
                <div className="space-y-3">
                    {plans.map((plan) => (
                        <Card
                            key={plan._id}
                            className={`rounded-2xl border-0 shadow-sm transition-all ${
                                plan.isActive ? 'ring-2 ring-primary bg-primary/5' : ''
                            }`}
                        >
                            <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="text-lg font-semibold">{plan.name}</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {plan.durationWeeks} weeks
                                        </p>
                                    </div>
                                    {plan.isActive && (
                                        <Badge className="bg-primary text-primary-foreground">
                                            <CheckCircle className="h-3 w-3 mr-1" />
                                            Active
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleManagePlan(plan)}
                                        className="rounded-lg"
                                    >
                                        <Settings2 className="h-4 w-4 mr-2" />
                                        Manage
                                    </Button>
                                    {!plan.isActive && (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => handleSetActive(plan)}
                                            disabled={setActivePlanMutation.isPending}
                                            className="rounded-lg"
                                        >
                                            Set Active
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditPlan(plan)}
                                        className="rounded-lg"
                                    >
                                        <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDuplicatePlan(plan)}
                                        disabled={duplicatePlanMutation.isPending}
                                        className="rounded-lg"
                                    >
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeletePlan(plan)}
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create Plan Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Create Training Plan</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="plan-name">Plan Name</Label>
                            <Input
                                id="plan-name"
                                value={newPlanName}
                                onChange={(e) => setNewPlanName(e.target.value)}
                                placeholder="e.g., Push/Pull/Legs"
                                className="rounded-lg"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="plan-weeks">Duration (weeks)</Label>
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setNewPlanWeeks((w) => Math.max(1, w - 1))}
                                    disabled={newPlanWeeks <= 1}
                                    className="h-10 w-10 rounded-lg"
                                >
                                    -
                                </Button>
                                <span className="w-12 text-center font-semibold text-lg">
                                    {newPlanWeeks}
                                </span>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setNewPlanWeeks((w) => Math.min(52, w + 1))}
                                    disabled={newPlanWeeks >= 52}
                                    className="h-10 w-10 rounded-lg"
                                >
                                    +
                                </Button>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setCreateDialogOpen(false)}
                            className="rounded-lg"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreatePlan}
                            disabled={!newPlanName.trim() || createPlanMutation.isPending}
                            className="rounded-lg"
                        >
                            {createPlanMutation.isPending ? 'Creating...' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Delete Plan?</DialogTitle>
                        <DialogDescription>
                            This will permanently delete &quot;{planToDelete?.name}&quot; and all its
                            exercises. This cannot be undone.
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
                            disabled={deletePlanMutation.isPending}
                            className="rounded-lg"
                        >
                            {deletePlanMutation.isPending ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Plan Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit Training Plan</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="edit-plan-name">Plan Name</Label>
                            <Input
                                id="edit-plan-name"
                                value={editPlanName}
                                onChange={(e) => setEditPlanName(e.target.value)}
                                placeholder="e.g., Push/Pull/Legs"
                                className="rounded-lg"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-plan-weeks">Duration (weeks)</Label>
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setEditPlanWeeks((w) => Math.max(1, w - 1))}
                                    disabled={editPlanWeeks <= 1}
                                    className="h-10 w-10 rounded-lg"
                                >
                                    -
                                </Button>
                                <span className="w-12 text-center font-semibold text-lg">
                                    {editPlanWeeks}
                                </span>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setEditPlanWeeks((w) => Math.min(52, w + 1))}
                                    disabled={editPlanWeeks >= 52}
                                    className="h-10 w-10 rounded-lg"
                                >
                                    +
                                </Button>
                            </div>
                            {planToEdit && editPlanWeeks < planToEdit.durationWeeks && (
                                <p className="text-sm text-warning">
                                    Warning: Reducing weeks may result in loss of progress data for removed weeks.
                                </p>
                            )}
                        </div>
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
                            onClick={confirmEdit}
                            disabled={!editPlanName.trim() || updatePlanMutation.isPending}
                            className="rounded-lg"
                        >
                            {updatePlanMutation.isPending ? 'Saving...' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}


