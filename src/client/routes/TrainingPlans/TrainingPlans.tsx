import { useState } from 'react';
import { Button } from '@/client/components/ui/button';
import { Card, CardContent } from '@/client/components/ui/card';
import { Input } from '@/client/components/ui/input';
import { Label } from '@/client/components/ui/label';
import { Badge } from '@/client/components/ui/badge';
import { Skeleton } from '@/client/components/ui/skeleton';
import { toast } from '@/client/components/ui/toast';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/client/components/ui/dialog';
import { Plus, Calendar, Trash2, Settings2, CheckCircle, Copy, Edit2, Sparkles, MoreVertical, Download, FileJson, ChevronDown, Save, Clipboard } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/client/components/ui/dropdown-menu';
import { usePlans, useCreatePlan, useUpdatePlan, useDeletePlan, useSetActivePlan, useDuplicatePlan, useExportPlan } from './hooks';
import { useWorkoutStore } from '@/client/features/workout';
import { useTrainingPlansStore } from './store';
import { ManagePlan } from '../ManagePlan';
import { CreatePlanWithAiDialog, ImportPlanDialog } from './components';
import type { TrainingPlanClient } from '@/server/database/collections/trainingPlans/types';

export function TrainingPlans() {
    // Queries and mutations
    const { data, error, isLoading } = usePlans();
    const createPlanMutation = useCreatePlan();
    const updatePlanMutation = useUpdatePlan();
    const deletePlanMutation = useDeletePlan();
    const setActivePlanMutation = useSetActivePlan();
    const duplicatePlanMutation = useDuplicatePlan();
    const exportPlanMutation = useExportPlan();

    // Workout store for syncing active plan
    const setActivePlan = useWorkoutStore((state) => state.setActivePlan);
    
    // Route-level store for persisting selected plan
    const selectedPlanId = useTrainingPlansStore((state) => state.selectedPlanId);
    const setSelectedPlanId = useTrainingPlansStore((state) => state.setSelectedPlanId);

    // Local UI state
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [aiDialogOpen, setAiDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [importDialogOpen, setImportDialogOpen] = useState(false);
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
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog context
    const [planToExport, setPlanToExport] = useState<TrainingPlanClient | null>(null);

    const plans = (data?.plans || []).slice().sort((a, b) => {
        // Active plan always first
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return 0;
    });
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
        const planId = planToDelete._id;

        // Close dialog immediately - optimistic update already removed from list
        setDeleteDialogOpen(false);
        
        // Clear selection if the deleted plan was selected
        if (selectedPlanId === planId) {
            setSelectedPlanId(null);
        }
        
        setPlanToDelete(null);

        deletePlanMutation.mutate(
            { planId },
            {
                onError: (error) => {
                    toast.error(`Failed to delete plan: ${error.message}`);
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

    const handleExportPlan = (plan: TrainingPlanClient) => {
        setPlanToExport(plan);
        setExportDialogOpen(true);
    };

    const handleExportAsFile = () => {
        if (!planToExport) return;
        
        exportPlanMutation.mutate(
            { planId: planToExport._id },
            {
                onSuccess: (data) => {
                    if (!data.exportData) return;
                    
                    // Create JSON blob and trigger download
                    const jsonString = JSON.stringify(data.exportData, null, 2);
                    const blob = new Blob([jsonString], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${data.exportData.planName.replace(/[^a-z0-9]/gi, '_')}_plan.json`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    
                    toast.success(`Exported "${planToExport.name}" successfully`);
                    setExportDialogOpen(false);
                    setPlanToExport(null);
                },
                onError: (error) => {
                    toast.error(error.message || 'Failed to export plan');
                },
            }
        );
    };

    const handleExportCopyJson = () => {
        if (!planToExport) return;
        
        exportPlanMutation.mutate(
            { planId: planToExport._id },
            {
                onSuccess: async (data) => {
                    if (!data.exportData) return;
                    
                    const jsonString = JSON.stringify(data.exportData, null, 2);
                    
                    try {
                        await navigator.clipboard.writeText(jsonString);
                        toast.success('JSON copied to clipboard');
                        setExportDialogOpen(false);
                        setPlanToExport(null);
                    } catch {
                        toast.error('Failed to copy to clipboard');
                    }
                },
                onError: (error) => {
                    toast.error(error.message || 'Failed to export plan');
                },
            }
        );
    };

    const handleAiPlanSuccess = (planId: string) => {
        // If this is the first plan, set it as active in store
        if (plans.length === 0) {
            setActivePlan(planId);
        }
        // Auto-select the new plan to show it in ManagePlan
        setSelectedPlanId(planId);
    };

    const handleImportSuccess = (planId: string) => {
        // If this is the first plan, set it as active in store
        if (plans.length === 0) {
            setActivePlan(planId);
        }
        // Auto-select the new plan to show it in ManagePlan
        setSelectedPlanId(planId);
    };

    // Loading state - show skeleton when loading without cached data
    if (isLoading || !hasData) {
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
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button className="rounded-xl">
                            <Plus className="mr-2 h-4 w-4" />
                            New Plan
                            <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setCreateDialogOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Manually
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setAiDialogOpen(true)}>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Create with AI
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setImportDialogOpen(true)}>
                            <FileJson className="h-4 w-4 mr-2" />
                            Import from JSON
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
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
                        <div className="flex flex-wrap gap-2 justify-center">
                            <Button onClick={() => setCreateDialogOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Create Manually
                            </Button>
                            <Button onClick={() => setAiDialogOpen(true)} variant="outline">
                                <Sparkles className="mr-2 h-4 w-4" />
                                Create with AI
                            </Button>
                            <Button onClick={() => setImportDialogOpen(true)} variant="outline">
                                <FileJson className="mr-2 h-4 w-4" />
                                Import JSON
                            </Button>
                        </div>
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
                                    <div className="flex items-center gap-2">
                                        {plan.isActive && (
                                            <Badge className="bg-primary text-primary-foreground">
                                                <CheckCircle className="h-3 w-3 mr-1" />
                                                Active
                                            </Badge>
                                        )}
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="rounded-lg h-8 w-8 p-0"
                                                >
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            {!plan.isActive && (
                                                <>
                                                    <DropdownMenuItem 
                                                        onClick={() => handleSetActive(plan)}
                                                        disabled={setActivePlanMutation.isPending}
                                                        className="text-primary focus:text-primary"
                                                    >
                                                        <CheckCircle className="h-4 w-4 mr-2" />
                                                        Set Active
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                </>
                                            )}
                                            <DropdownMenuItem onClick={() => handleEditPlan(plan)}>
                                                <Edit2 className="h-4 w-4 mr-2" />
                                                Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem 
                                                onClick={() => handleDuplicatePlan(plan)}
                                                disabled={duplicatePlanMutation.isPending}
                                            >
                                                <Copy className="h-4 w-4 mr-2" />
                                                Duplicate
                                            </DropdownMenuItem>
                                            <DropdownMenuItem 
                                                onClick={() => handleExportPlan(plan)}
                                                disabled={exportPlanMutation.isPending}
                                            >
                                                <Download className="h-4 w-4 mr-2" />
                                                Export JSON
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem 
                                                onClick={() => handleDeletePlan(plan)}
                                                className="text-destructive focus:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleManagePlan(plan)}
                                    className="rounded-lg"
                                >
                                    <Settings2 className="h-4 w-4 mr-2" />
                                    Manage
                                </Button>
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
                            className="rounded-lg"
                        >
                            Delete
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

            {/* Export Plan Dialog */}
            <Dialog open={exportDialogOpen} onOpenChange={(open) => {
                setExportDialogOpen(open);
                if (!open) setPlanToExport(null);
            }}>
                <DialogContent className="rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Export Plan</DialogTitle>
                        <DialogDescription>
                            Choose how to export &quot;{planToExport?.name}&quot;
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 py-4">
                        <Button
                            variant="outline"
                            className="h-14 justify-start rounded-xl"
                            onClick={handleExportAsFile}
                            disabled={exportPlanMutation.isPending}
                        >
                            <Save className="h-5 w-5 mr-3" />
                            <div className="text-left">
                                <div className="font-medium">Save as File</div>
                                <div className="text-sm text-muted-foreground">Download JSON file to your device</div>
                            </div>
                        </Button>
                        <Button
                            variant="outline"
                            className="h-14 justify-start rounded-xl"
                            onClick={handleExportCopyJson}
                            disabled={exportPlanMutation.isPending}
                        >
                            <Clipboard className="h-5 w-5 mr-3" />
                            <div className="text-left">
                                <div className="font-medium">Copy JSON</div>
                                <div className="text-sm text-muted-foreground">Copy to clipboard for pasting elsewhere</div>
                            </div>
                        </Button>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setExportDialogOpen(false);
                                setPlanToExport(null);
                            }}
                            className="rounded-lg"
                        >
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Plan with AI Dialog */}
            <CreatePlanWithAiDialog
                open={aiDialogOpen}
                onOpenChange={setAiDialogOpen}
                onSuccess={handleAiPlanSuccess}
                existingPlansCount={plans.length}
            />

            {/* Import Plan Dialog */}
            <ImportPlanDialog
                open={importDialogOpen}
                onOpenChange={setImportDialogOpen}
                onSuccess={handleImportSuccess}
            />
        </div>
    );
}


