/**
 * Export Button Component
 *
 * Button that exports dashboard data to CSV and triggers download.
 * Shows loading state during export and success toast.
 */

import { useState } from 'react';
import { Button } from '@/client/components/template/ui/button';
import { Download, Check } from 'lucide-react';
import { exportDashboardToCSV } from '../utils/exportToCsv';
import type { GetDashboardAnalyticsResponse } from '@/apis/template/dashboard/types';

interface ExportButtonProps {
    metrics: GetDashboardAnalyticsResponse | undefined;
    startDate: Date;
    endDate: Date;
}

export function ExportButton({ metrics, startDate, endDate }: ExportButtonProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state for export feedback
    const [exportState, setExportState] = useState<'idle' | 'exporting' | 'success'>('idle');

    const handleExport = () => {
        if (!metrics) return;

        setExportState('exporting');

        // Small delay to show loading state
        setTimeout(() => {
            try {
                exportDashboardToCSV(metrics, startDate, endDate);
                setExportState('success');

                // Reset to idle after showing success
                setTimeout(() => {
                    setExportState('idle');
                }, 2000);
            } catch {
                setExportState('idle');
            }
        }, 300);
    };

    const isDisabled = !metrics || exportState === 'exporting';

    return (
        <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={handleExport}
            disabled={isDisabled}
        >
            {exportState === 'success' ? (
                <>
                    <Check className="h-4 w-4 text-success" />
                    <span className="hidden sm:inline">Exported</span>
                </>
            ) : exportState === 'exporting' ? (
                <>
                    <Download className="h-4 w-4 animate-pulse" />
                    <span className="hidden sm:inline">Exporting...</span>
                </>
            ) : (
                <>
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Export CSV</span>
                </>
            )}
        </Button>
    );
}
