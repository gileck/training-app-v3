/**
 * Training Plan Export Handlers
 *
 * Provides handlers for exporting training plans in different formats.
 */

import { toast } from '@/client/components/template/ui/toast';
import type { TrainingPlanClient } from '@/server/database/collections/project/trainingPlans/types';
import type { UseMutationResult } from '@tanstack/react-query';
import type { ExportPlanResponse } from '@/apis/project/training-plans/types';

interface UseExportHandlersProps {
    planToExport: TrainingPlanClient | null;
    exportPlanMutation: UseMutationResult<ExportPlanResponse, Error, { planId: string }, unknown>;
    setExportDialogOpen: (open: boolean) => void;
    setPlanToExport: (plan: TrainingPlanClient | null) => void;
}

/**
 * Provides handler functions for exporting training plans.
 *
 * Supports:
 * - Export as downloadable JSON file
 * - Copy JSON to clipboard
 *
 * Both methods retrieve the full plan data from the server including all exercises
 * and exercise definitions in a portable format.
 *
 * @param props - Export mutation and dialog state
 * @returns Object containing export handler functions
 */
export function useExportHandlers({
    planToExport,
    exportPlanMutation,
    setExportDialogOpen,
    setPlanToExport,
}: UseExportHandlersProps) {
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

    return {
        handleExportAsFile,
        handleExportCopyJson,
    };
}
