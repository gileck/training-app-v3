import { Button } from '@/client/components/ui/button';
import { X, Pencil, Copy, Trash2, Loader2 } from 'lucide-react';
import { useIsSessionActive } from '@/client/features/project/workout';

interface SelectionActionBarProps {
    selectedCount: number;
    deletableCount: number;
    onDelete: () => void;
    onDuplicate: () => void;
    onEdit: () => void;
    onCancel: () => void;
    isDeleting?: boolean;
    isDuplicating?: boolean;
    isEditing?: boolean;
}

export function SelectionActionBar({
    selectedCount,
    deletableCount,
    onDelete,
    onDuplicate,
    onEdit,
    onCancel,
    isDeleting,
    isDuplicating,
    isEditing,
}: SelectionActionBarProps) {
    const isSingleSelection = selectedCount === 1;
    const isAnyLoading = isDeleting || isDuplicating || isEditing;
    // Move up when FloatingWorkoutBar is visible to avoid overlap
    const isWorkoutActive = useIsSessionActive();

    return (
        <div className={`fixed left-4 right-4 bg-card border border-border rounded-xl shadow-lg p-2 z-50 ${
            isWorkoutActive ? 'bottom-[150px]' : 'bottom-20'
        }`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onCancel}
                        className="h-8 w-8"
                        disabled={isAnyLoading}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium">
                        {selectedCount} selected
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onEdit}
                        className="h-9 w-9"
                        disabled={isAnyLoading}
                        title="Edit date"
                    >
                        {isEditing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Pencil className="h-4 w-4" />
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onDuplicate}
                        className="h-9 w-9"
                        disabled={!isSingleSelection || isAnyLoading}
                        title={isSingleSelection ? 'Duplicate' : 'Select one item to duplicate'}
                    >
                        {isDuplicating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Copy className="h-4 w-4" />
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onDelete}
                        className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={deletableCount === 0 || isAnyLoading}
                        title="Delete"
                    >
                        {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Trash2 className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
