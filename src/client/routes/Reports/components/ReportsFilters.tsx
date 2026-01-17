/**
 * Reports Filters Component
 */

import { Button } from '@/client/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/client/components/ui/select';
import { List, Layers } from 'lucide-react';
import type { ReportType } from '@/apis/reports/types';
import type { StatusFilterOption } from '../store';

interface ReportsFiltersProps {
    viewMode: 'individual' | 'grouped';
    setViewMode: (mode: 'individual' | 'grouped') => void;
    typeFilter: ReportType | 'all';
    setTypeFilter: (type: ReportType | 'all') => void;
    statusFilter: StatusFilterOption;
    setStatusFilter: (status: StatusFilterOption) => void;
    sortOrder: 'asc' | 'desc';
    setSortOrder: (order: 'asc' | 'desc') => void;
}

export function ReportsFilters({
    viewMode,
    setViewMode,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    sortOrder,
    setSortOrder,
}: ReportsFiltersProps) {
    return (
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

                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilterOption)}>
                    <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
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
    );
}
