/**
 * Grouped Report Card Component
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';
import { Button } from '@/client/components/ui/button';
import { Badge } from '@/client/components/ui/badge';
import { Bug, AlertCircle, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import type { GroupedReport } from '../utils';
import { formatDate } from '../utils';
import { ReportCard } from './ReportCard';

interface GroupedReportCardProps {
    group: GroupedReport;
}

export function GroupedReportCard({ group }: GroupedReportCardProps) {
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
