import { User, ExternalLink, Clock, Calendar } from 'lucide-react';
import type { FeatureRequestClient } from '@/apis/feature-requests/types';

interface MetadataIconRowProps {
    request: FeatureRequestClient;
}

// Staleness threshold in days
const STALE_THRESHOLD_DAYS = 7;

/**
 * Format a date as a short string (e.g., "Jan 28")
 */
function formatShortDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Compact icon row for metadata display in collapsed card view
 * Shows: Owner, GitHub issue link, GitHub PR link, Activity staleness indicator
 * All icons are 14px (h-3.5), muted colors, and tappable
 */
export function MetadataIconRow({ request }: MetadataIconRowProps) {
    // Calculate days since last update
    const daysSinceUpdate = Math.floor(
        (Date.now() - new Date(request.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    const isStale = daysSinceUpdate > STALE_THRESHOLD_DAYS;

    return (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {/* Owner indicator - show only icon on mobile, name on larger screens */}
            {request.requestedByName && (
                <div
                    className="flex items-center gap-1"
                    title={`Requested by ${request.requestedByName}`}
                    aria-label={`Requested by ${request.requestedByName}`}
                >
                    <User className="h-3.5 w-3.5" />
                    <span className="hidden md:inline text-xs">{request.requestedByName}</span>
                </div>
            )}

            {/* GitHub issue link - compact display */}
            {request.githubIssueUrl && (
                <a
                    href={request.githubIssueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                    title={`GitHub Issue #${request.githubIssueNumber}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span className="text-xs">#{request.githubIssueNumber}</span>
                </a>
            )}

            {/* Created date - always show */}
            <div
                className="flex items-center gap-1"
                title={`Created: ${new Date(request.createdAt).toLocaleString()}`}
            >
                <Calendar className="h-3.5 w-3.5" />
                <span className="text-xs">{formatShortDate(request.createdAt)}</span>
            </div>

            {/* Activity staleness indicator - only show if >7 days */}
            {isStale && (
                <div
                    className="flex items-center gap-1 text-warning"
                    title={`Last updated ${daysSinceUpdate} days ago`}
                >
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-xs">{daysSinceUpdate}d</span>
                </div>
            )}
        </div>
    );
}
