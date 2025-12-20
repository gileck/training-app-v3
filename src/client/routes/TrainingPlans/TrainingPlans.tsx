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
import { Plus, Calendar, Trash2, Settings2, CheckCircle } from 'lucide-react';
import { useRouter } from '../../router';
import { usePlans, useCreatePlan, useDeletePlan, useSetActivePlan } from './hooks';
import { useWorkoutStore } from '@/client/features/workout';
import type { TrainingPlanClient } from '@/server/database/collections/trainingPlans/types';

export function TrainingPlans() {
    const { navigate } = useRouter();

    // Queries and mutations
    const { data, isLoading, error } = usePlans();
    const createPlanMutation = useCreatePlan();
    const deletePlanMutation = useDeletePlan();
    const setActivePlanMutation = useSetActivePlan();

    // Workout store for syncing active plan
    const setActivePlan = useWorkoutStore((state) => state.setActivePlan);

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

    const plans = data?.plans || [];

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
        navigate(`/training-plans/${plan._id}`);
    };

    // Loading state
    if (isLoading && !data) {
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
        </div>
    );
}

