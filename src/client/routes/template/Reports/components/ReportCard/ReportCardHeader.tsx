/**
 * ReportCard Header Section
 */

import { Bug, AlertCircle, Gauge, Clock, Search } from 'lucide-react';
import { Badge } from '@/client/components/template/ui/badge';
import type { ReportClient, InvestigationStatus } from '@/apis/reports/types';
import { STATUS_COLORS, STATUS_ICONS, formatDate } from '../../utils';

const INVESTIGATION_STATUS_LABELS: Record<InvestigationStatus, string> = {
    needs_info: 'Needs More Info',
    root_cause_found: 'Root Cause Found',
    complex_fix: 'Complex Fix Required',
    not_a_bug: 'Not a Bug',
    inconclusive: 'Inconclusive',
};

interface ReportCardHeaderProps {
    report: ReportClient;
}

export function ReportCardHeader({ report }: ReportCardHeaderProps) {
    return (
        <>
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

            {/* Investigation Headline */}
            {report.investigation && (
                <div className="flex items-start gap-2 mb-3 p-2 rounded bg-primary/10 border border-primary/20">
                    <Search className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-primary">{report.investigation.headline}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {INVESTIGATION_STATUS_LABELS[report.investigation.status]} • {report.investigation.confidence} confidence
                        </p>
                    </div>
                </div>
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
                {report.occurrenceCount > 1 && (
                    <span className="inline-flex items-center rounded-full bg-destructive/20 px-2.5 py-0.5 text-destructive font-medium">
                        {report.occurrenceCount}x occurrences
                    </span>
                )}
            </div>
        </>
    );
}
