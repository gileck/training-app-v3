/**
 * Reports Header Component
 */

import { Button } from '@/client/components/ui/button';
import { Filter, Trash2 } from 'lucide-react';
import type { ReportClient } from '@/apis/reports/types';
import { groupReports } from '../utils';

interface ReportsHeaderProps {
    reports: ReportClient[] | undefined;
    viewMode: 'individual' | 'grouped';
    showLoading: boolean;
    isPending: boolean;
    onDeleteAll: () => void;
}

export function ReportsHeader({
    reports,
    viewMode,
    showLoading,
    isPending,
    onDeleteAll,
}: ReportsHeaderProps) {
    return (
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
                    onClick={onDeleteAll}
                    disabled={isPending}
                    className="text-destructive hover:text-destructive h-8 sm:h-9"
                >
                    <Trash2 className="h-4 w-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Delete All</span>
                </Button>
            )}
        </div>
    );
}
