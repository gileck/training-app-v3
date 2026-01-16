/**
 * ReportCard Actions Section
 */

import { useEffect, useRef } from 'react';
import { Button } from '@/client/components/ui/button';
import {
    Copy,
    ChevronDown,
    ChevronUp,
    MoreVertical,
    CheckCircle,
    Search,
    XCircle,
    Trash2
} from 'lucide-react';
import type { ReportStatus } from '@/apis/reports/types';

interface ReportCardActionsProps {
    isExpanded: boolean;
    onToggleExpanded: () => void;
    onCopyDetails: () => void;
    showActionsMenu: boolean;
    onToggleActionsMenu: () => void;
    onCopyId: () => void;
    currentStatus: ReportStatus;
    onStatusChange: (status: ReportStatus) => void;
    onDeleteClick: () => void;
}

export function ReportCardActions({
    isExpanded,
    onToggleExpanded,
    onCopyDetails,
    showActionsMenu,
    onToggleActionsMenu,
    onCopyId,
    currentStatus,
    onStatusChange,
    onDeleteClick,
}: ReportCardActionsProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        if (!showActionsMenu) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onToggleActionsMenu();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showActionsMenu, onToggleActionsMenu]);

    return (
        <div className="flex items-center gap-2 pt-3 mt-3 border-t">
            <Button
                variant="ghost"
                size="sm"
                onClick={onToggleExpanded}
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
                onClick={onCopyDetails}
                className="flex-1 h-9"
            >
                <Copy className="mr-1.5 h-4 w-4" />
                Copy Details
            </Button>
            <div className="relative" ref={menuRef}>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onToggleActionsMenu}
                    className="h-9 w-9 p-0"
                >
                    <MoreVertical className="h-4 w-4" />
                </Button>
                {showActionsMenu && (
                    <>
                        {/* Backdrop */}
                        <div className="fixed inset-0 z-40" onClick={onToggleActionsMenu} />
                        {/* Menu */}
                        <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border bg-background shadow-lg z-50">
                            <div className="p-1">
                                <button
                                    onClick={() => {
                                        onCopyId();
                                        onToggleActionsMenu();
                                    }}
                                    className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent text-left"
                                >
                                    <Copy className="h-4 w-4" />
                                    Copy ID
                                </button>
                                <div className="my-1 border-t border-b py-1">
                                    <button
                                        onClick={() => {
                                            onStatusChange('new');
                                            onToggleActionsMenu();
                                        }}
                                        className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent text-left ${currentStatus === 'new' ? 'bg-accent' : ''}`}
                                    >
                                        <span>New</span>
                                        {currentStatus === 'new' && <CheckCircle className="h-4 w-4" />}
                                    </button>
                                    <button
                                        onClick={() => {
                                            onStatusChange('investigating');
                                            onToggleActionsMenu();
                                        }}
                                        className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent text-left ${currentStatus === 'investigating' ? 'bg-accent' : ''}`}
                                    >
                                        <span>Investigating</span>
                                        {currentStatus === 'investigating' && <Search className="h-4 w-4" />}
                                    </button>
                                    <button
                                        onClick={() => {
                                            onStatusChange('resolved');
                                            onToggleActionsMenu();
                                        }}
                                        className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent text-left ${currentStatus === 'resolved' ? 'bg-accent' : ''}`}
                                    >
                                        <span>Resolved</span>
                                        {currentStatus === 'resolved' && <CheckCircle className="h-4 w-4 text-success" />}
                                    </button>
                                    <button
                                        onClick={() => {
                                            onStatusChange('closed');
                                            onToggleActionsMenu();
                                        }}
                                        className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent text-left ${currentStatus === 'closed' ? 'bg-accent' : ''}`}
                                    >
                                        <span>Closed</span>
                                        {currentStatus === 'closed' && <XCircle className="h-4 w-4" />}
                                    </button>
                                </div>
                                <button
                                    onClick={() => {
                                        onDeleteClick();
                                        onToggleActionsMenu();
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
    );
}
