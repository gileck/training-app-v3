import { X } from 'lucide-react';
import { cn } from '@/client/lib/utils';
import type { FeatureRequestPriority } from '@/apis/template/feature-requests/types';

const priorityColors: Record<FeatureRequestPriority, string> = {
    critical: 'bg-destructive text-destructive-foreground',
    high: 'bg-warning text-warning-foreground',
    medium: 'bg-primary text-primary-foreground',
    low: 'bg-secondary text-secondary-foreground',
};

interface FilterChipButtonProps {
    label: string;
    isActive: boolean;
    onClick: () => void;
    icon?: React.ReactNode;
    variant?: 'default' | 'priority';
    priorityLevel?: FeatureRequestPriority;
}

export function FilterChipButton({ label, isActive, onClick, icon, variant = 'default', priorityLevel }: FilterChipButtonProps) {
    if (variant === 'priority' && priorityLevel) {
        return (
            <button
                type="button"
                onClick={onClick}
                className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                    'hover:scale-105 active:scale-95',
                    isActive
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : 'border-border bg-background hover:bg-muted'
                )}
            >
                <span className={cn('h-2 w-2 rounded-full', priorityColors[priorityLevel])} />
                <span>{label}</span>
                {isActive && <X className="h-3 w-3" />}
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                'hover:scale-105 active:scale-95',
                isActive
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-background hover:bg-muted'
            )}
        >
            {icon}
            <span>{label}</span>
            {isActive && <X className="h-3 w-3" />}
        </button>
    );
}
