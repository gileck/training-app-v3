/**
 * Individual Report Card Component
 */

import { useState } from 'react';
import { useUpdateReportStatus, useDeleteReport } from '../hooks';
import { Card, CardContent } from '@/client/components/template/ui/card';
import { Loader2 } from 'lucide-react';
import type { ReportClient, ReportStatus } from '@/apis/template/reports/types';
import { ConfirmDialog } from '@/client/components/template/ui/confirm-dialog';
import { toast } from '@/client/components/template/ui/toast';
import { ReportCardHeader, ReportCardActions, ReportCardDetails, formatReportDetails } from './ReportCard/index';

interface ReportCardProps {
    report: ReportClient;
}

export function ReportCard({ report }: ReportCardProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state
    const [isExpanded, setIsExpanded] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state
    const [showActionsMenu, setShowActionsMenu] = useState(false);
    const updateStatusMutation = useUpdateReportStatus();
    const deleteReportMutation = useDeleteReport();

    const handleCopyId = async () => {
        try {
            await navigator.clipboard.writeText(report._id);
            toast.success('Report ID copied');
        } catch {
            toast.error('Failed to copy ID');
        }
    };

    const handleCopyDetailsWithToast = async () => {
        try {
            const details = formatReportDetails(report);
            await navigator.clipboard.writeText(details);
            toast.success('Report details copied');
        } catch {
            toast.error('Failed to copy details');
        }
    };

    const handleStatusChange = (newStatus: ReportStatus) => {
        updateStatusMutation.mutate({ reportId: report._id, status: newStatus });
    };

    const handleDelete = () => {
        setShowDeleteDialog(false);
        deleteReportMutation.mutate(report._id);
    };

    return (
        <Card className="mb-3 overflow-visible border shadow-sm bg-card relative">
            {/* Loading overlay */}
            {deleteReportMutation.isPending && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-30 flex items-center justify-center rounded-lg">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm font-medium">Deleting report...</p>
                    </div>
                </div>
            )}
            <CardContent className="p-0">
                {/* Mobile-first header */}
                <div className="p-4 pb-3">
                    <ReportCardHeader report={report} />

                    {/* Mobile Action Bar */}
                    <ReportCardActions
                        isExpanded={isExpanded}
                        onToggleExpanded={() => setIsExpanded(!isExpanded)}
                        onCopyDetails={handleCopyDetailsWithToast}
                        showActionsMenu={showActionsMenu}
                        onToggleActionsMenu={() => setShowActionsMenu(!showActionsMenu)}
                        onCopyId={handleCopyId}
                        currentStatus={report.status}
                        onStatusChange={handleStatusChange}
                        onDeleteClick={() => setShowDeleteDialog(true)}
                    />
                </div>

                {/* Expanded Details */}
                {isExpanded && <ReportCardDetails report={report} />}

                <ConfirmDialog
                    open={showDeleteDialog}
                    onOpenChange={(open) => {
                        if (!deleteReportMutation.isPending) {
                            setShowDeleteDialog(open);
                        }
                    }}
                    title="Delete Report"
                    description={`Are you sure you want to delete this ${report.type} report? This action cannot be undone and will permanently delete the report and any associated files from storage.`}
                    confirmText={deleteReportMutation.isPending ? "Deleting..." : "Delete Report"}
                    variant="destructive"
                    onConfirm={handleDelete}
                />
            </CardContent>
        </Card>
    );
}
