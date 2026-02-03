import { Button } from '@/client/components/ui/button';

interface MultiSelectActionBarProps {
    selectedCount: number;
    onCancel: () => void;
    onConfigure: () => void;
}

export function MultiSelectActionBar({
    selectedCount,
    onCancel,
    onConfigure,
}: MultiSelectActionBarProps) {
    return (
        <div className="sticky bottom-0 pt-4 pb-2 bg-background border-t">
            <div className="flex gap-3">
                <Button
                    variant="outline"
                    onClick={onCancel}
                    className="flex-1 h-12 rounded-xl"
                >
                    Cancel
                </Button>
                <Button
                    onClick={onConfigure}
                    className="flex-1 h-12 rounded-xl"
                >
                    Configure {selectedCount} Exercise{selectedCount > 1 ? 's' : ''}
                </Button>
            </div>
        </div>
    );
}
