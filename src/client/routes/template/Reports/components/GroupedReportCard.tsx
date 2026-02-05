/**
 * Grouped Report Card Component
 */

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/template/ui/card';
import { Button } from '@/client/components/template/ui/button';
import { Badge } from '@/client/components/template/ui/badge';
import { Bug, AlertCircle, ChevronDown, ChevronUp, Clock, MoreVertical, Search, CheckCircle, XCircle, Trash2, Loader2 } from 'lucide-react';
import type { GroupedReport } from '../utils';
import type { ReportStatus } from '@/apis/template/reports/types';
import { formatDate } from '../utils';
import { ReportCard } from './ReportCard';
import { useBatchUpdateStatus, useBatchDeleteReports } from '../hooks';
import { ConfirmDialog } from '@/client/components/template/ui/confirm-dialog';

interface GroupedReportCardProps {
    group: GroupedReport;
}

export function GroupedReportCard({ group }: GroupedReportCardProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state
    const [isExpanded, setIsExpanded] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state
    const [showActionsMenu, setShowActionsMenu] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const batchUpdateStatusMutation = useBatchUpdateStatus();
    const batchDeleteMutation = useBatchDeleteReports();

    const reportIds = group.reports.map(r => r._id);
    const isPending = batchUpdateStatusMutation.isPending || batchDeleteMutation.isPending;

    // Close menu when clicking outside
    useEffect(() => {
        if (!showActionsMenu) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowActionsMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showActionsMenu]);

    const handleStatusChange = (status: ReportStatus) => {
        batchUpdateStatusMutation.mutate({ reportIds, status });
        setShowActionsMenu(false);
    };

    const handleDeleteAll = () => {
        setShowDeleteDialog(false);
        batchDeleteMutation.mutate(reportIds);
    };

    return (
        <Card className="mb-4 relative">
            {/* Loading overlay */}
            {isPending && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-30 flex items-center justify-center rounded-lg">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm font-medium">
                            {batchDeleteMutation.isPending ? 'Deleting reports...' : 'Updating reports...'}
                        </p>
                    </div>
                </div>
            )}
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        {group.type === 'bug' ? (
                            <Bug className="h-5 w-5 text-destructive" />
                        ) : (
                            <AlertCircle className="h-5 w-5 text-warning" />
                        )}
                        <CardTitle className="text-base">
                            {group.type === 'bug' ? 'Bug Report' : 'Error'}
                        </CardTitle>
                        <Badge variant="secondary">
                            {group.count}x
                        </Badge>
                    </div>
                    {/* Actions Menu */}
                    <div className="relative" ref={menuRef}>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowActionsMenu(!showActionsMenu)}
                            className="h-8 w-8 p-0"
                        >
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                        {showActionsMenu && (
                            <>
                                {/* Backdrop */}
                                <div className="fixed inset-0 z-40" onClick={() => setShowActionsMenu(false)} />
                                {/* Menu */}
                                <div className="absolute right-0 top-full mt-1 w-52 rounded-lg border bg-background shadow-lg z-50">
                                    <div className="p-1">
                                        <div className="px-3 py-1.5 text-xs text-muted-foreground font-medium">
                                            Update all {group.count} reports
                                        </div>
                                        <div className="my-1 border-t border-b py-1">
                                            <button
                                                onClick={() => handleStatusChange('new')}
                                                className="w-full flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent text-left"
                                            >
                                                <span>Mark all as New</span>
                                                <CheckCircle className="h-4 w-4 text-muted-foreground" />
                                            </button>
                                            <button
                                                onClick={() => handleStatusChange('investigating')}
                                                className="w-full flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent text-left"
                                            >
                                                <span>Mark all as Investigating</span>
                                                <Search className="h-4 w-4 text-muted-foreground" />
                                            </button>
                                            <button
                                                onClick={() => handleStatusChange('resolved')}
                                                className="w-full flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent text-left"
                                            >
                                                <span>Mark all as Resolved</span>
                                                <CheckCircle className="h-4 w-4 text-success" />
                                            </button>
                                            <button
                                                onClick={() => handleStatusChange('closed')}
                                                className="w-full flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent text-left"
                                            >
                                                <span>Mark all as Closed</span>
                                                <XCircle className="h-4 w-4 text-muted-foreground" />
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setShowDeleteDialog(true);
                                                setShowActionsMenu(false);
                                            }}
                                            className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10 text-left"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            Delete all {group.count} reports
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {/* Error/Description */}
                    {group.type === 'error' ? (
                        <p className="rounded bg-destructive/10 px-2 py-1 font-mono text-sm text-destructive line-clamp-2">
                            {group.key}
                        </p>
                    ) : (
                        <p className="rounded bg-muted px-2 py-1 text-sm text-foreground line-clamp-2">
                            {group.key}
                        </p>
                    )}

                    {/* Occurrence Info */}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>First: {formatDate(group.firstOccurrence)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>Last: {formatDate(group.lastOccurrence)}</span>
                        </div>
                    </div>

                    {/* Expand/Collapse */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        {isExpanded ? (
                            <>
                                <ChevronUp className="mr-1 h-4 w-4" />
                                Hide {group.count} reports
                            </>
                        ) : (
                            <>
                                <ChevronDown className="mr-1 h-4 w-4" />
                                Show {group.count} reports
                            </>
                        )}
                    </Button>

                    {/* Individual Reports */}
                    {isExpanded && (
                        <div className="mt-4 space-y-2 border-t pt-4">
                            {group.reports.map((report) => (
                                <ReportCard key={report._id} report={report} />
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>

            <ConfirmDialog
                open={showDeleteDialog}
                onOpenChange={(open) => {
                    if (!batchDeleteMutation.isPending) {
                        setShowDeleteDialog(open);
                    }
                }}
                title="Delete All Reports in Group"
                description={`Are you sure you want to delete all ${group.count} reports in this group? This action cannot be undone and will permanently delete all reports and any associated files from storage.`}
                confirmText={batchDeleteMutation.isPending ? "Deleting..." : `Delete ${group.count} Reports`}
                variant="destructive"
                onConfirm={handleDeleteAll}
            />
        </Card>
    );
}
