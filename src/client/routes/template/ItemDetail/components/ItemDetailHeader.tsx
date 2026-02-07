import { Badge } from '@/client/components/template/ui/badge';
import { Bug, Lightbulb, Clock } from 'lucide-react';

interface ItemDetailHeaderProps {
    isFeature: boolean;
    title: string;
    status: string;
    createdAt: string;
    priority?: string;
    source?: string;
    requestedByName?: string;
    route?: string;
}

export function ItemDetailHeader({
    isFeature,
    title,
    status,
    createdAt,
    priority,
    source,
    requestedByName,
    route,
}: ItemDetailHeaderProps) {
    return (
        <div className="mb-6">
            <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant={isFeature ? 'default' : 'destructive'}>
                    {isFeature ? (
                        <><Lightbulb className="mr-1 h-3 w-3" /> Feature</>
                    ) : (
                        <><Bug className="mr-1 h-3 w-3" /> Bug</>
                    )}
                </Badge>
                <Badge variant="outline">{status}</Badge>
                {priority && <Badge variant="secondary">{priority}</Badge>}
                {source && <Badge variant="secondary">via {source}</Badge>}
            </div>
            <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>{new Date(createdAt).toLocaleDateString()}</span>
                {requestedByName && <span>by {requestedByName}</span>}
                {route && <span>on {route}</span>}
            </div>
        </div>
    );
}
