import { Button } from '@/client/components/template/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/client/components/template/ui/dropdown-menu';
import { CircleEllipsis, Copy, Loader2, RefreshCw, Trash2 } from 'lucide-react';

export function DocumentActionsMenu({
    disabled,
    hasDocument,
    isDuplicating,
    isDeleting,
    onRefresh,
    onDuplicate,
    onDelete,
}: {
    disabled: boolean;
    hasDocument: boolean;
    isDuplicating: boolean;
    isDeleting: boolean;
    onRefresh: () => void | Promise<void>;
    onDuplicate: () => void | Promise<void>;
    onDelete: () => void | Promise<void>;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="min-w-0" disabled={disabled}>
                    <CircleEllipsis className="mr-2 h-4 w-4" />
                    Actions
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                    onSelect={() => {
                        void onRefresh();
                    }}
                >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh document
                </DropdownMenuItem>
                <DropdownMenuItem
                    disabled={!hasDocument}
                    onSelect={() => {
                        void onDuplicate();
                    }}
                >
                    {isDuplicating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Copy className="mr-2 h-4 w-4" />
                    )}
                    Duplicate document
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    disabled={!hasDocument}
                    className="text-destructive focus:text-destructive"
                    onSelect={() => {
                        void onDelete();
                    }}
                >
                    {isDeleting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Delete document
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
