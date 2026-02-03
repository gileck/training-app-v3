/**
 * Profile Section Component
 * Card-based section with title and icon for grouping profile fields
 */

import { ReactNode } from 'react';

interface ProfileSectionProps {
    title: string;
    icon?: ReactNode;
    children: ReactNode;
}

export function ProfileSection({ title, icon, children }: ProfileSectionProps) {
    return (
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
            {/* Section header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
                {icon && (
                    <span className="text-muted-foreground">
                        {icon}
                    </span>
                )}
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    {title}
                </h2>
            </div>

            {/* Section content */}
            <div className="divide-y divide-border">
                {children}
            </div>
        </div>
    );
}
