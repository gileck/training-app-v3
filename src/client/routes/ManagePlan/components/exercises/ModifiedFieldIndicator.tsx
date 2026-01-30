/**
 * Modified Field Indicator
 * 
 * Shows a small "Modified" badge next to overridden fields.
 * Clicking reveals original value and offers reset option.
 */

import { Button } from '@/client/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/client/components/ui/popover';
import { Badge } from '@/client/components/ui/badge';
import { RotateCcw } from 'lucide-react';

interface ModifiedFieldIndicatorProps {
    /** Original value to display */
    originalValue: string;
    /** Callback when user clicks reset */
    onReset: () => void;
    /** Optional label for the field */
    fieldLabel?: string;
}

export function ModifiedFieldIndicator({
    originalValue,
    onReset,
    fieldLabel = 'Original',
}: ModifiedFieldIndicatorProps) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Badge
                    variant="secondary"
                    className="ml-2 text-[10px] px-1.5 py-0 h-4 cursor-pointer hover:bg-primary/20 bg-primary/10 text-primary"
                >
                    Modified
                </Badge>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start">
                <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                        {fieldLabel}:
                    </div>
                    <div className="text-sm font-medium max-w-[200px] truncate">
                        {originalValue || '(empty)'}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            onReset();
                        }}
                        className="w-full h-8 text-xs"
                    >
                        <RotateCcw className="h-3 w-3 mr-1.5" />
                        Reset to default
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
