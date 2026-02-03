import { useState } from 'react';
import { Card } from '@/client/components/template/ui/card';
import { toast } from '@/client/components/template/ui/toast';
import { usePlans, useCreatePlan, useUpdatePlan, useDeletePlan, useSetActivePlan, useDuplicatePlan, useExportPlan } from './hooks';
import { useWorkoutStore } from '@/client/features/project/workout';
import { useTrainingPlansStore } from './store';
import { ManagePlan } from '../ManagePlan';
import {
    CreatePlanWithAiDialog,
    ImportPlanDialog,
    SharePlanDialog,
    PlanCard,
    CreatePlanDialog,
    EditPlanDialog,
    DeletePlanConfirm,
    ExportPlanDialog,
    PlansLoadingSkeleton,
    PlansEmptyState,
    PlansHeader,
} from './components';
import { useExportHandlers } from './useExportHandlers';
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
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog context
    const [planToDelete, setPlanToDelete] = useState<TrainingPlanClient | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog context
    const [planToEdit, setPlanToEdit] = useState<TrainingPlanClient | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog context
    const [planToExport, setPlanToExport] = useState<TrainingPlanClient | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog context
    const [planToShare, setPlanToShare] = useState<TrainingPlanClient | null>(null);

    const plans = (data?.plans || []).slice().sort((a, b) => {
        // Active plan always first
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return 0;
    });
    const hasData = data !== undefined;

    const handleCreatePlan = async (name: string, weeks: number) => {
        createPlanMutation.mutate(
            { name, durationWeeks: weeks },
            {
                onSuccess: (newPlan) => {
                    setCreateDialogOpen(false);
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
        setEditDialogOpen(true);
    };

    const confirmEdit = (planId: string, name: string, weeks: number) => {
        updatePlanMutation.mutate(
            {
                planId,
                name,
                durationWeeks: weeks,
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

    const handleSharePlan = (plan: TrainingPlanClient) => {
        setPlanToShare(plan);
        setShareDialogOpen(true);
    };

    // Export handlers
    const { handleExportAsFile, handleExportCopyJson } = useExportHandlers({
        planToExport,
        exportPlanMutation,
        setExportDialogOpen,
        setPlanToExport,
    });

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
        return <PlansLoadingSkeleton />;
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
            <PlansHeader
                onCreateManual={() => setCreateDialogOpen(true)}
                onCreateWithAi={() => setAiDialogOpen(true)}
                onImport={() => setImportDialogOpen(true)}
            />

            {/* Empty state */}
            {plans.length === 0 ? (
                <PlansEmptyState
                    onCreateManual={() => setCreateDialogOpen(true)}
                    onCreateWithAi={() => setAiDialogOpen(true)}
                    onImport={() => setImportDialogOpen(true)}
                />
            ) : (
                /* Plan list */
                <div className="space-y-3">
                    {plans.map((plan) => (
                        <PlanCard
                            key={plan._id}
                            plan={plan}
                            onManage={handleManagePlan}
                            onSetActive={handleSetActive}
                            onEdit={handleEditPlan}
                            onDuplicate={handleDuplicatePlan}
                            onExport={handleExportPlan}
                            onShare={handleSharePlan}
                            onDelete={handleDeletePlan}
                            isSetActiveLoading={setActivePlanMutation.isPending}
                            isDuplicateLoading={duplicatePlanMutation.isPending}
                            isExportLoading={exportPlanMutation.isPending}
                        />
                    ))}
                </div>
            )}

            {/* Create Plan Dialog */}
            <CreatePlanDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                onConfirm={handleCreatePlan}
                isLoading={createPlanMutation.isPending}
            />

            {/* Delete Confirmation Dialog */}
            <DeletePlanConfirm
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                plan={planToDelete}
                onConfirm={confirmDelete}
            />

            {/* Edit Plan Dialog */}
            <EditPlanDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                plan={planToEdit}
                onConfirm={confirmEdit}
                isLoading={updatePlanMutation.isPending}
            />

            {/* Export Plan Dialog */}
            <ExportPlanDialog
                open={exportDialogOpen}
                onOpenChange={(open) => {
                    setExportDialogOpen(open);
                    if (!open) setPlanToExport(null);
                }}
                plan={planToExport}
                onExportAsFile={handleExportAsFile}
                onCopyJson={handleExportCopyJson}
                isLoading={exportPlanMutation.isPending}
            />

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

            {/* Share Plan Dialog */}
            {planToShare && (
                <SharePlanDialog
                    open={shareDialogOpen}
                    onOpenChange={(open) => {
                        setShareDialogOpen(open);
                        if (!open) setPlanToShare(null);
                    }}
                    planId={planToShare._id}
                    planName={planToShare.name}
                />
            )}
        </div>
    );
}


