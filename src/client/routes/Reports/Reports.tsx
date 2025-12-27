/**
 * Reports Dashboard
 * 
 * Public dashboard to view and manage bug/error reports.
 */

import { useState, useEffect, useRef } from 'react';
import { useReports, useUpdateReportStatus, useDeleteReport, useDeleteAllReports } from './hooks';
import { useReportsStore } from './store';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';
import { Button } from '@/client/components/ui/button';
import { Badge } from '@/client/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/client/components/ui/select';
import {
    Bug,
    AlertCircle,
    Copy,
    ChevronDown,
    ChevronUp,
    Filter,
    Loader2,
    CheckCircle,
    Search,
    Clock,
    XCircle,
    Layers,
    List,
    Gauge,
    Trash2,
    MoreVertical
} from 'lucide-react';
import type { ReportClient, ReportType, ReportStatus } from '@/apis/reports/types';
import { ConfirmDialog } from './ConfirmDialog';
import { toast } from '@/client/components/ui/toast';

// Types for grouped view
interface GroupedReport {
    key: string; // error message or description
    type: ReportType;
    count: number;
    firstOccurrence: string;
    lastOccurrence: string;
    reports: ReportClient[];
}

const STATUS_COLORS: Record<ReportStatus, string> = {
    new: 'bg-info',
    investigating: 'bg-warning',
    resolved: 'bg-success',
    closed: 'bg-muted-foreground',
};

const STATUS_ICONS: Record<ReportStatus, React.ReactNode> = {
    new: <AlertCircle className="h-3 w-3" />,
    investigating: <Search className="h-3 w-3" />,
    resolved: <CheckCircle className="h-3 w-3" />,
    closed: <XCircle className="h-3 w-3" />,
};

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
}

function ReportCard({ report }: { report: ReportClient }) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state
    const [isExpanded, setIsExpanded] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state
    const [showActionsMenu, setShowActionsMenu] = useState(false);
    const updateStatusMutation = useUpdateReportStatus();
    const deleteReportMutation = useDeleteReport();
    const menuRef = useRef<HTMLDivElement>(null);

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

    const handleCopyDetails = async () => {
        const sessionLogsFormatted = report.sessionLogs.length > 0
            ? report.sessionLogs.map(log =>
                `  [${log.timestamp}]${log.performanceTime !== undefined ? ` [+${log.performanceTime}ms]` : ''} [${log.level.toUpperCase()}] [${log.feature}] ${log.message}${log.meta ? ` | Meta: ${JSON.stringify(log.meta)}` : ''}${log.route ? ` | Route: ${log.route}` : ''} | Network: ${log.networkStatus}`
            ).join('\n')
            : '  No session logs';

        const performanceEntriesFormatted = report.performanceEntries && report.performanceEntries.length > 0
            ? report.performanceEntries.map(entry =>
                `  [${entry.entryType}] ${entry.name} | Start: ${entry.startTime}ms | Duration: ${entry.duration}ms${entry.transferSize ? ` | Size: ${entry.transferSize}B` : ''}`
            ).join('\n')
            : null;

        const details = `
================================================================================
BUG/ERROR REPORT
================================================================================

REPORT METADATA
---------------
- Report ID: ${report._id}
- Type: ${report.type.toUpperCase()}${report.category ? ` (${report.category})` : ''}
- Status: ${report.status}
- Created: ${formatDate(report.createdAt)}
- Updated: ${formatDate(report.updatedAt)}

CONTEXT
-------
- Route/Page: ${report.route}
- Network Status: ${report.networkStatus}

${report.description ? `DESCRIPTION
-----------
${report.description}
` : ''}
${report.errorMessage ? `ERROR MESSAGE
-------------
${report.errorMessage}
` : ''}
${report.stackTrace ? `STACK TRACE
-----------
${report.stackTrace}
` : ''}
USER INFORMATION
----------------
${report.userInfo ? `- User ID: ${report.userInfo.userId || 'N/A'}
- Username: ${report.userInfo.username || 'N/A'}
- Email: ${report.userInfo.email || 'N/A'}` : '- User: Anonymous (not logged in)'}

BROWSER/DEVICE INFORMATION
--------------------------
- User Agent: ${report.browserInfo.userAgent}
- Viewport: ${report.browserInfo.viewport.width}x${report.browserInfo.viewport.height}
- Language: ${report.browserInfo.language}

${report.screenshot ? `SCREENSHOT
----------
${report.screenshot.startsWith('data:')
                    ? `[Base64 image data - ${Math.round(report.screenshot.length / 1024)}KB]`
                    : report.screenshot}
` : ''}
${performanceEntriesFormatted ? `PERFORMANCE ENTRIES (${report.performanceEntries?.length || 0} entries)
--------------------------------------------------------
${performanceEntriesFormatted}
` : ''}
SESSION LOGS (${report.sessionLogs.length} entries)
--------------------------------------------------
${sessionLogsFormatted}

================================================================================
END OF REPORT
================================================================================
        `.trim();

        await navigator.clipboard.writeText(details);
    };

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
            await handleCopyDetails();
            toast.success('Report details copied');
        } catch {
            toast.error('Failed to copy details');
        }
    };

    const handleStatusChange = (newStatus: ReportStatus) => {
        updateStatusMutation.mutate({ reportId: report._id, status: newStatus });
    };

    const handleDelete = () => {
        deleteReportMutation.mutate(report._id, {
            onSuccess: () => {
                toast.success('Report deleted successfully');
                setShowDeleteDialog(false);
            },
            onError: (error) => {
                toast.error(`Failed to delete report: ${error instanceof Error ? error.message : 'Unknown error'}`);
            },
        });
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
                    <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            {report.type === 'bug' && report.category === 'performance' ? (
                                <Gauge className="h-5 w-5 text-secondary flex-shrink-0" />
                            ) : report.type === 'bug' ? (
                                <Bug className="h-5 w-5 text-destructive flex-shrink-0" />
                            ) : (
                                <AlertCircle className="h-5 w-5 text-warning flex-shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                                <div className="font-semibold text-sm truncate">
                                    {report.type === 'bug' && report.category === 'performance'
                                        ? 'Performance Issue'
                                        : report.type === 'bug'
                                            ? 'Bug Report'
                                            : 'Error'}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                    <Clock className="h-3 w-3" />
                                    {formatDate(report.createdAt)}
                                </div>
                            </div>
                        </div>
                        <Badge variant="outline" className={`${STATUS_COLORS[report.status]} text-primary-foreground flex-shrink-0 text-xs`}>
                            {STATUS_ICONS[report.status]}
                        </Badge>
                    </div>

                    {/* Description */}
                    {report.description && (
                        <p className="text-sm text-foreground mb-3 line-clamp-2">{report.description}</p>
                    )}
                    {report.errorMessage && (
                        <p className="text-sm font-mono text-destructive mb-3 line-clamp-2 bg-destructive/10 rounded px-2 py-1">
                            {report.errorMessage}
                        </p>
                    )}

                    {/* Quick Info Pills */}
                    <div className="flex flex-wrap gap-1.5 text-xs mb-3">
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">
                            {report.route}
                        </span>
                        {report.userInfo?.username && (
                            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">
                                {report.userInfo.username}
                            </span>
                        )}
                        {report.performanceEntries && report.performanceEntries.length > 0 && (
                            <span className="inline-flex items-center rounded-full bg-secondary/20 px-2.5 py-0.5 text-secondary">
                                <Gauge className="mr-1 inline h-3 w-3" />
                                {report.performanceEntries.length}
                            </span>
                        )}
                    </div>

                    {/* Mobile Action Bar */}
                    <div className="flex items-center gap-2 pt-3 mt-3 border-t">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="flex-1 h-9"
                        >
                            {isExpanded ? (
                                <>
                                    <ChevronUp className="mr-1.5 h-4 w-4" />
                                    Less
                                </>
                            ) : (
                                <>
                                    <ChevronDown className="mr-1.5 h-4 w-4" />
                                    Details
                                </>
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCopyDetailsWithToast}
                            className="flex-1 h-9"
                        >
                            <Copy className="mr-1.5 h-4 w-4" />
                            Copy Details
                        </Button>
                        <div className="relative" ref={menuRef}>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowActionsMenu(!showActionsMenu)}
                                className="h-9 w-9 p-0"
                            >
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                            {showActionsMenu && (
                                <>
                                    {/* Backdrop */}
                                    <div className="fixed inset-0 z-40" onClick={() => setShowActionsMenu(false)} />
                                    {/* Menu */}
                                    <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border bg-background shadow-lg z-50">
                                        <div className="p-1">
                                            <button
                                                onClick={() => {
                                                    handleCopyId();
                                                    setShowActionsMenu(false);
                                                }}
                                                className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent text-left"
                                            >
                                                <Copy className="h-4 w-4" />
                                                Copy ID
                                            </button>
                                            <div className="my-1 border-t border-b py-1">
                                                <button
                                                    onClick={() => {
                                                        handleStatusChange('new');
                                                        setShowActionsMenu(false);
                                                    }}
                                                    className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent text-left ${report.status === 'new' ? 'bg-accent' : ''}`}
                                                >
                                                    <span>New</span>
                                                    {report.status === 'new' && <CheckCircle className="h-4 w-4" />}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        handleStatusChange('investigating');
                                                        setShowActionsMenu(false);
                                                    }}
                                                    className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent text-left ${report.status === 'investigating' ? 'bg-accent' : ''}`}
                                                >
                                                    <span>Investigating</span>
                                                    {report.status === 'investigating' && <Search className="h-4 w-4" />}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        handleStatusChange('resolved');
                                                        setShowActionsMenu(false);
                                                    }}
                                                    className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent text-left ${report.status === 'resolved' ? 'bg-accent' : ''}`}
                                                >
                                                    <span>Resolved</span>
                                                    {report.status === 'resolved' && <CheckCircle className="h-4 w-4 text-success" />}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        handleStatusChange('closed');
                                                        setShowActionsMenu(false);
                                                    }}
                                                    className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent text-left ${report.status === 'closed' ? 'bg-accent' : ''}`}
                                                >
                                                    <span>Closed</span>
                                                    {report.status === 'closed' && <XCircle className="h-4 w-4" />}
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
                                                Delete Report
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                    <div className="px-4 pb-4 space-y-4 border-t bg-muted/30 pt-4">
                        {/* Screenshot */}
                        {report.screenshot && (
                            <div>
                                <h4 className="mb-2 text-sm font-medium">Screenshot</h4>
                                {/* eslint-disable-next-line @next/next/no-img-element -- base64 user-uploaded screenshot */}
                                <img
                                    src={report.screenshot}
                                    alt="Bug screenshot"
                                    className="w-full rounded border object-contain"
                                />
                            </div>
                        )}

                        {/* Stack Trace */}
                        {report.stackTrace && (
                            <div>
                                <h4 className="mb-2 text-sm font-medium">Stack Trace</h4>
                                <pre className="max-h-48 overflow-auto rounded bg-muted p-3 text-xs">
                                    {report.stackTrace}
                                </pre>
                            </div>
                        )}

                        {/* Browser Info */}
                        <div>
                            <h4 className="mb-2 text-sm font-medium">Browser Info</h4>
                            <div className="rounded bg-muted p-3 text-xs space-y-1">
                                <div><span className="text-muted-foreground">Viewport:</span> {report.browserInfo.viewport.width}x{report.browserInfo.viewport.height}</div>
                                <div className="text-muted-foreground truncate">{report.browserInfo.userAgent}</div>
                            </div>
                        </div>

                        {/* Session Logs */}
                        {report.sessionLogs.length > 0 && (
                            <div>
                                <h4 className="mb-2 text-sm font-medium">
                                    Session Logs ({report.sessionLogs.length})
                                </h4>
                                <div className="max-h-64 overflow-auto rounded bg-muted p-3">
                                    {report.sessionLogs.map((log) => (
                                        <div
                                            key={log.id}
                                            className={`mb-1 text-xs ${log.level === 'error' ? 'text-destructive' :
                                                log.level === 'warn' ? 'text-warning' :
                                                    'text-muted-foreground'
                                                }`}
                                        >
                                            <span className="font-mono">
                                                [{new Date(log.timestamp).toLocaleTimeString()}]
                                            </span>
                                            <span className="ml-1 font-medium">[{log.feature}]</span>
                                            <span className="ml-1">{log.message}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

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

// Group reports by error message or description
function groupReports(reports: ReportClient[]): GroupedReport[] {
    const groups = new Map<string, GroupedReport>();

    for (const report of reports) {
        // Use error message for errors, description for bugs
        const key = report.errorMessage || report.description || 'Unknown';

        if (groups.has(key)) {
            const group = groups.get(key)!;
            group.count++;
            group.reports.push(report);

            // Update first/last occurrence
            if (new Date(report.createdAt) < new Date(group.firstOccurrence)) {
                group.firstOccurrence = report.createdAt;
            }
            if (new Date(report.createdAt) > new Date(group.lastOccurrence)) {
                group.lastOccurrence = report.createdAt;
            }
        } else {
            groups.set(key, {
                key,
                type: report.type,
                count: 1,
                firstOccurrence: report.createdAt,
                lastOccurrence: report.createdAt,
                reports: [report],
            });
        }
    }

    // Sort by last occurrence (most recent first)
    return Array.from(groups.values()).sort(
        (a, b) => new Date(b.lastOccurrence).getTime() - new Date(a.lastOccurrence).getTime()
    );
}

function GroupedReportCard({ group }: { group: GroupedReport }) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <Card className="mb-4">
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
        </Card>
    );
}

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
            onError: (error) => {
                toast.error(`Failed to delete reports: ${error instanceof Error ? error.message : 'Unknown error'}`);
            },
        });
    };

    return (
        <div className="space-y-4 pb-6">
            {/* Mobile-first Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold">Reports</h1>
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mt-0.5">
                        <Filter className="h-3.5 w-3.5" />
                        {viewMode === 'grouped' && reports ? (
                            <span>{groupReports(reports).length} unique · {reports.length} total</span>
                        ) : (
                            <span>{reports?.length || 0} reports</span>
                        )}
                    </div>
                </div>
                {!showLoading && reports && reports.length > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDeleteAllDialog(true)}
                        disabled={deleteAllMutation.isPending}
                        className="text-destructive hover:text-destructive h-8 sm:h-9"
                    >
                        <Trash2 className="h-4 w-4 sm:mr-1.5" />
                        <span className="hidden sm:inline">Delete All</span>
                    </Button>
                )}
            </div>

            {/* Compact Mobile Filters */}
            <div className="space-y-2">
                {/* View Mode */}
                <div className="flex gap-2">
                    <Button
                        variant={viewMode === 'individual' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('individual')}
                        className="flex-1 h-9"
                    >
                        <List className="mr-1.5 h-4 w-4" />
                        <span className="hidden xs:inline">Individual</span>
                    </Button>
                    <Button
                        variant={viewMode === 'grouped' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('grouped')}
                        className="flex-1 h-9"
                    >
                        <Layers className="mr-1.5 h-4 w-4" />
                        <span className="hidden xs:inline">Grouped</span>
                    </Button>
                </div>

                {/* Filters Row */}
                <div className="grid grid-cols-3 gap-2">
                    <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as ReportType | 'all')}>
                        <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="bug">Bugs</SelectItem>
                            <SelectItem value="error">Errors</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ReportStatus | 'all')}>
                        <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="investigating">Investigating</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as 'asc' | 'desc')}>
                        <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="desc">Newest</SelectItem>
                            <SelectItem value="asc">Oldest</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

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

