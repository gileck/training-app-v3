import { Calendar, User, FileText } from 'lucide-react';
import { StatusBadge, PriorityBadge } from './components/StatusBadge';
import type { FeatureRequestClient } from '@/apis/template/feature-requests/types';

interface FeatureRequestDetailHeaderProps {
    request: FeatureRequestClient;
}

export function FeatureRequestDetailHeader({ request }: FeatureRequestDetailHeaderProps) {
    return (
        <div className="mb-4 space-y-3 sm:mb-6 sm:space-y-4">
            <h1 className="text-xl font-bold leading-tight sm:text-2xl md:text-3xl">{request.title}</h1>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <StatusBadge status={request.status} />
                <PriorityBadge priority={request.priority} />
            </div>

            <div className="flex flex-wrap gap-1.5 text-xs sm:gap-2 sm:text-sm">
                <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 sm:px-2.5">
                    <User className="h-3 w-3 text-muted-foreground sm:h-3.5 sm:w-3.5" />
                    <span className="text-muted-foreground">{request.requestedByName}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 sm:px-2.5">
                    <Calendar className="h-3 w-3 text-muted-foreground sm:h-3.5 sm:w-3.5" />
                    <span className="text-muted-foreground">
                        {new Date(request.createdAt).toLocaleDateString()}
                    </span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 sm:px-2.5">
                    <Calendar className="h-3 w-3 text-muted-foreground sm:h-3.5 sm:w-3.5" />
                    <span className="text-muted-foreground">
                        Updated {new Date(request.updatedAt).toLocaleDateString()}
                    </span>
                </div>
                {request.page && (
                    <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 sm:px-2.5">
                        <FileText className="h-3 w-3 text-muted-foreground sm:h-3.5 sm:w-3.5" />
                        <span className="text-muted-foreground truncate max-w-[120px] sm:max-w-none">{request.page}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
