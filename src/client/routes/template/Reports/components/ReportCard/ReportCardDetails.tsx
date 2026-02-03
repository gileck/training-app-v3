/**
 * ReportCard Expanded Details Section
 */

import { Search } from 'lucide-react';
import type { ReportClient, InvestigationStatus } from '@/apis/reports/types';
import { formatDate, generatePerformanceSummary } from '../../utils';

const INVESTIGATION_STATUS_LABELS: Record<InvestigationStatus, string> = {
    needs_info: 'Needs More Info',
    root_cause_found: 'Root Cause Found',
    complex_fix: 'Complex Fix Required',
    not_a_bug: 'Not a Bug',
    inconclusive: 'Inconclusive',
};

interface ReportCardDetailsProps {
    report: ReportClient;
}

export function ReportCardDetails({ report }: ReportCardDetailsProps) {
    return (
        <div className="px-4 pb-4 space-y-4 border-t bg-muted/30 pt-4">
            {/* Investigation Summary */}
            {report.investigation && (
                <div>
                    <h4 className="mb-2 text-sm font-medium flex items-center gap-2">
                        <Search className="h-4 w-4" />
                        Investigation Summary
                    </h4>
                    <div className="rounded bg-muted p-3 text-xs space-y-3">
                        <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center rounded-full bg-primary/20 px-2 py-0.5 text-primary font-medium">
                                {INVESTIGATION_STATUS_LABELS[report.investigation.status]}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-secondary/20 px-2 py-0.5 text-secondary">
                                {report.investigation.confidence} confidence
                            </span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Summary:</span>
                            <p className="mt-1">{report.investigation.summary}</p>
                        </div>
                        {report.investigation.rootCause && (
                            <div>
                                <span className="text-muted-foreground">Root Cause:</span>
                                <p className="mt-1">{report.investigation.rootCause}</p>
                            </div>
                        )}
                        {report.investigation.proposedFix && (
                            <div>
                                <span className="text-muted-foreground">
                                    Proposed Fix ({report.investigation.proposedFix.complexity} complexity):
                                </span>
                                <p className="mt-1">{report.investigation.proposedFix.description}</p>
                                {report.investigation.proposedFix.files.length > 0 && (
                                    <div className="mt-2">
                                        <span className="text-muted-foreground">Files to change:</span>
                                        <ul className="mt-1 list-disc list-inside">
                                            {report.investigation.proposedFix.files.map((file, idx) => (
                                                <li key={idx} className="text-xs">
                                                    <code className="bg-background px-1 rounded">{file.path}</code>
                                                    <span className="text-muted-foreground ml-1">- {file.changes}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                        {report.investigation.analysisNotes && (
                            <div>
                                <span className="text-muted-foreground">Analysis Notes:</span>
                                <p className="mt-1">{report.investigation.analysisNotes}</p>
                            </div>
                        )}
                        {report.investigation.filesExamined.length > 0 && (
                            <div>
                                <span className="text-muted-foreground">Files Examined ({report.investigation.filesExamined.length}):</span>
                                <p className="mt-1 font-mono text-[10px] break-all">
                                    {report.investigation.filesExamined.join(', ')}
                                </p>
                            </div>
                        )}
                        <div className="text-muted-foreground text-[10px] pt-2 border-t">
                            Investigated {formatDate(report.investigation.investigatedAt)} by {report.investigation.investigatedBy}
                        </div>
                    </div>
                </div>
            )}

            {/* Performance Summary (for performance reports) */}
            {report.category === 'performance' && (() => {
                const summary = generatePerformanceSummary(report);
                return summary ? (
                    <div>
                        <h4 className="mb-2 text-sm font-medium">Performance Summary</h4>
                        <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs font-mono whitespace-pre">
                            {summary}
                        </pre>
                    </div>
                ) : null;
            })()}

            {/* Screenshot */}
            {report.screenshot && (
                <div>
                    <h4 className="mb-2 text-sm font-medium">Screenshot</h4>
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

            {/* Occurrence Info (for deduplicated errors) */}
            {report.occurrenceCount > 1 && (
                <div>
                    <h4 className="mb-2 text-sm font-medium">Occurrence History</h4>
                    <div className="rounded bg-muted p-3 text-xs space-y-1">
                        <div>
                            <span className="text-muted-foreground">Total Occurrences:</span>{' '}
                            <span className="font-medium text-destructive">{report.occurrenceCount}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">First Occurrence:</span>{' '}
                            {formatDate(report.firstOccurrence)}
                        </div>
                        <div>
                            <span className="text-muted-foreground">Last Occurrence:</span>{' '}
                            {formatDate(report.lastOccurrence)}
                        </div>
                        {(() => {
                            const first = new Date(report.firstOccurrence).getTime();
                            const last = new Date(report.lastOccurrence).getTime();
                            const durationMs = last - first;
                            const hours = Math.floor(durationMs / (1000 * 60 * 60));
                            const days = Math.floor(hours / 24);
                            const remainingHours = hours % 24;

                            if (days > 0) {
                                return (
                                    <div>
                                        <span className="text-muted-foreground">Duration:</span>{' '}
                                        {days}d {remainingHours}h
                                    </div>
                                );
                            } else if (hours > 0) {
                                return (
                                    <div>
                                        <span className="text-muted-foreground">Duration:</span>{' '}
                                        {hours}h
                                    </div>
                                );
                            }
                            return null;
                        })()}
                    </div>
                </div>
            )}

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
    );
}
