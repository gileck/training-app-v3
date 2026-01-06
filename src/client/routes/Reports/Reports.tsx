/**
 * Reports Page Component
 *
 * Displays bug reports and errors with filtering, grouping, and management capabilities.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/client/components/ui/card';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useReports, useDeleteAllReports } from './hooks';
import { useReportsStore } from './store';
import { ConfirmDialog } from '@/client/components/ui/confirm-dialog';
import { toast } from '@/client/components/ui/toast';
import { ReportsHeader } from './components/ReportsHeader';
import { ReportsFilters } from './components/ReportsFilters';
import { ReportCard } from './components/ReportCard';
import { GroupedReportCard } from './components/GroupedReportCard';
import { groupReports } from './utils';

export function Reports() {
    // Persistent UI state from store
    const typeFilter = useReportsStore((state) => state.typeFilter);
    const setTypeFilter = useReportsStore((state) => state.setTypeFilter);
    const statusFilter = useReportsStore((state) => state.statusFilter);
    const setStatusFilter = useReportsStore((state) => state.setStatusFilter);
    const sortOrder = useReportsStore((state) => state.sortOrder);
    const setSortOrder = useReportsStore((state) => state.setSortOrder);
    const viewMode = useReportsStore((state) => state.viewMode);
    const setViewMode = useReportsStore((state) => state.setViewMode);

    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);

    const { data: reports, isLoading, error } = useReports({
        type: typeFilter === 'all' ? undefined : typeFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        sortOrder,
    });

    // Determine if we should show loading state:
    // - isLoading is true when fetching without cached data
    // - reports is undefined when no data exists yet (before first fetch completes)
    const showLoading = isLoading || reports === undefined;

    const deleteAllMutation = useDeleteAllReports();

    const handleDeleteAll = () => {
        deleteAllMutation.mutate(undefined, {
            onSuccess: (data) => {
                toast.success(`Successfully deleted ${data.deletedCount || 0} reports`);
                setShowDeleteAllDialog(false);
            },
            onError: (err) => {
                toast.error(`Failed to delete reports: ${err instanceof Error ? err.message : 'Unknown error'}`);
            },
        });
    };

    return (
        <div className="space-y-4 pb-6">
            <ReportsHeader
                reports={reports}
                viewMode={viewMode}
                showLoading={showLoading}
                isPending={deleteAllMutation.isPending}
                onDeleteAll={() => setShowDeleteAllDialog(true)}
            />

            <ReportsFilters
                viewMode={viewMode}
                setViewMode={setViewMode}
                typeFilter={typeFilter}
                setTypeFilter={setTypeFilter}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                sortOrder={sortOrder}
                setSortOrder={setSortOrder}
            />

            <ConfirmDialog
                open={showDeleteAllDialog}
                onOpenChange={(open) => {
                    if (!deleteAllMutation.isPending) {
                        setShowDeleteAllDialog(open);
                    }
                }}
                title="Delete All Reports"
                description={`Are you sure you want to delete ALL ${reports?.length || 0} reports? This action cannot be undone and will permanently delete all reports and their associated files from storage.`}
                confirmText={deleteAllMutation.isPending ? "Deleting..." : "Delete All Reports"}
                variant="destructive"
                onConfirm={handleDeleteAll}
            />

            {/* Reports List */}
            {showLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : error ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
                        <p className="mt-4 text-muted-foreground">
                            Failed to load reports. Please try again.
                        </p>
                    </CardContent>
                </Card>
            ) : reports?.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <CheckCircle className="mx-auto h-12 w-12 text-success" />
                        <p className="mt-4 text-muted-foreground">
                            No reports found. Great job!
                        </p>
                    </CardContent>
                </Card>
            ) : viewMode === 'grouped' ? (
                <div>
                    {groupReports(reports || []).map((group) => (
                        <GroupedReportCard key={group.key} group={group} />
                    ))}
                </div>
            ) : (
                <div>
                    {reports?.map((report) => (
                        <ReportCard key={report._id} report={report} />
                    ))}
                </div>
            )}
        </div>
    );
}
