import { Button } from '@/client/components/template/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from '@/client/components/template/ui/dropdown-menu';
import { MoreVertical, Trash2 } from 'lucide-react';
import type { FeatureRequestStatus, FeatureRequestPriority } from '@/apis/template/feature-requests/types';

const allStatuses: { value: FeatureRequestStatus; label: string }[] = [
    { value: 'new', label: 'New' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'done', label: 'Done' },
    { value: 'rejected', label: 'Rejected' },
];

const allPriorities: FeatureRequestPriority[] = ['low', 'medium', 'high', 'critical'];

interface FeatureRequestCardMenuProps {
    currentStatus: FeatureRequestStatus;
    currentPriority: FeatureRequestPriority | undefined;
    onStatusChange: (status: FeatureRequestStatus) => void;
    onPriorityChange: (priority: FeatureRequestPriority) => void;
    onDeleteClick: () => void;
}

export function FeatureRequestCardMenu({
    currentStatus,
    currentPriority,
    onStatusChange,
    onPriorityChange,
    onDeleteClick,
}: FeatureRequestCardMenuProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Set Status</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                        {allStatuses.map((status) => (
                            <DropdownMenuItem
                                key={status.value}
                                onClick={() => onStatusChange(status.value)}
                                disabled={status.value === currentStatus}
                            >
                                {status.label}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Set Priority</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                        {allPriorities.map((priority) => (
                            <DropdownMenuItem
                                key={priority}
                                onClick={() => onPriorityChange(priority)}
                                disabled={priority === currentPriority}
                            >
                                {priority.charAt(0).toUpperCase() + priority.slice(1)}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    className="text-destructive"
                    onClick={onDeleteClick}
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
