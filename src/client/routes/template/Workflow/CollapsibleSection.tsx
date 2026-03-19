/**
 * CollapsibleSection
 *
 * Expandable/collapsible section header with count badge.
 */

import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export function CollapsibleSection({ title, count, collapsed, onToggle, children }: {
    title: string;
    count: number;
    collapsed: boolean;
    onToggle: () => void;
    children: ReactNode;
}) {
    return (
        <div className="mb-6">
            <button
                onClick={onToggle}
                className="flex items-center gap-1.5 mb-3 group"
            >
                {collapsed ? (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide group-hover:text-foreground transition-colors">
                    {title} ({count})
                </h2>
            </button>
            {!collapsed && (
                <div className="flex flex-col gap-2">
                    {children}
                </div>
            )}
        </div>
    );
}
