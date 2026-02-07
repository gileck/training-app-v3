/**
 * Reports Page Component
 *
 * Displays bug reports and errors with filtering, grouping, and management capabilities.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/client/components/template/ui/card';
import { Loader2, CheckCircle } from 'lucide-react';
import { useReports, useDeleteAllReports } from './hooks';
import { useReportsStore } from './store';
import { ConfirmDialog } from '@/client/components/template/ui/confirm-dialog';
import { toast } from '@/client/components/template/ui/toast';
import { Alert, AlertDescription, AlertTitle } from '@/client/components/template/ui/alert';
import { AlertCircle } from 'lucide-react';
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

    // For 'open' filter, we fetch all and filter client-side
    // This is because 'open' is a UI-only concept (new + investigating)
    const apiStatusFilter = statusFilter === 'open' || statusFilter === 'all' ? undefined : statusFilter;

    const { data: rawReports, isLoading, error } = useReports({
        type: typeFilter === 'all' ? undefined : typeFilter,
        status: apiStatusFilter,
        sortOrder,
    });

    // Apply client-side filtering for 'open' status
    const reports = statusFilter === 'open' && rawReports
        ? rawReports.filter(r => r.status === 'new' || r.status === 'investigating')
        : rawReports;

    // Determine if we should show loading state:
    // - isLoading is true when fetching without cached data
    // - reports is undefined when no data exists yet (before first fetch completes)
    // - Don't show loading if there's an error (show error state instead)
    const showLoading = !error && (isLoading || reports === undefined);

    const deleteAllMutation = useDeleteAllReports();

    const handleDeleteAll = () => {
        deleteAllMutation.mutate(undefined, {
            onSuccess: (data) => {
                toast.success(`Successfully deleted ${data.deletedCount || 0} reports`);
                setShowDeleteAllDialog(false);
            },
            onError: () => {
                toast.error('Failed to delete reports');
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
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error instanceof Error ? error.message : 'Failed to load reports'}</AlertDescription>
                </Alert>
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
