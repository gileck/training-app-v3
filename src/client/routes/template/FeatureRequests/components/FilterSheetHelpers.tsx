import { useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { cn } from '@/client/lib/utils';

interface FilterSectionProps {
    title: string;
    defaultExpanded?: boolean;
    children: React.ReactNode;
}

export function FilterSection({ title, defaultExpanded = true, children }: FilterSectionProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <div className="space-y-2">
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex w-full items-center justify-between py-2 text-sm font-medium text-foreground"
            >
                {title}
                {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
            </button>
            {isExpanded && <div className="pb-2">{children}</div>}
        </div>
    );
}

interface FilterOptionProps {
    label: string;
    isActive: boolean;
    onClick: () => void;
    icon?: React.ReactNode;
    colorDot?: string;
}

export function FilterOption({ label, isActive, onClick, icon, colorDot }: FilterOptionProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors',
                isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-foreground hover:bg-muted'
            )}
        >
            {colorDot && <span className={cn('h-3 w-3 rounded-full flex-shrink-0', colorDot)} />}
            {icon && <span className="flex-shrink-0">{icon}</span>}
            <span className="flex-1 text-left">{label}</span>
            {isActive && <X className="h-4 w-4 flex-shrink-0" />}
        </button>
    );
}
