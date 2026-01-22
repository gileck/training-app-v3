import { useState, ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/client/components/ui/button';
import { Card, CardContent, CardHeader } from '@/client/components/ui/card';

interface CollapsibleSectionProps {
    title: string;
    defaultExpanded?: boolean;
    count?: number;
    children: ReactNode;
}

/**
 * Reusable collapsible section component for detail pages
 * Provides consistent expand/collapse UI with optional count badge
 */
export function CollapsibleSection({
    title,
    defaultExpanded = false,
    count,
    children,
}: CollapsibleSectionProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">{title}</h3>
                        {count !== undefined && (
                            <span className="inline-flex items-center justify-center rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                                {count}
                            </span>
                        )}
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsExpanded(!isExpanded)}
                        aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
                    >
                        {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                        ) : (
                            <ChevronDown className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </CardHeader>
            {isExpanded && (
                <CardContent className="pt-0 transition-all duration-200 ease-in-out">
                    {children}
                </CardContent>
            )}
        </Card>
    );
}
