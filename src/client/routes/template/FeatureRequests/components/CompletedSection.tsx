/**
 * Completed Section Component
 *
 * Collapsible section for Done feature requests.
 * Collapsed by default to reduce clutter in the list.
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { Button } from '@/client/components/template/ui/button';
import { FeatureRequestCard } from './FeatureRequestCard';
import type { FeatureRequestClient } from '@/apis/template/feature-requests/types';

interface CompletedSectionProps {
    doneItems: FeatureRequestClient[];
}

export function CompletedSection({ doneItems }: CompletedSectionProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state
    const [isExpanded, setIsExpanded] = useState(false);

    if (doneItems.length === 0) {
        return null;
    }

    return (
        <div className="space-y-3">
            {/* Divider between active and done items */}
            <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                </div>
            </div>

            {/* Collapsible header */}
            <Button
                variant="ghost"
                className="w-full justify-between h-auto py-3 px-4"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="text-sm font-medium text-foreground">
                        Completed
                    </span>
                    <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                        {doneItems.length}
                    </span>
                </div>
                {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
            </Button>

            {/* Done items list */}
            {isExpanded && (
                <div className="space-y-4 pt-2">
                    {doneItems.map((request) => (
                        <FeatureRequestCard key={request._id} request={request} />
                    ))}
                </div>
            )}
        </div>
    );
}
