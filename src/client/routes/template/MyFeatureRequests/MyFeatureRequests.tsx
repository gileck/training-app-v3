import { Button } from '@/client/components/template/ui/button';
import { Loader2, Lightbulb, Inbox } from 'lucide-react';
import { MyRequestCard } from './components/MyRequestCard';
import { useMyFeatureRequests } from './hooks';
import { useFeatureRequestStore } from '@/client/features';

export function MyFeatureRequests() {
    const { data: requests, isLoading, error } = useMyFeatureRequests();
    const openDialog = useFeatureRequestStore((s) => s.openDialog);

    // Loading state
    if (isLoading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2">
                <p className="text-destructive">Failed to load your feature requests</p>
                <p className="text-sm text-muted-foreground">{error.message}</p>
            </div>
        );
    }

    // Empty state
    if (!requests || requests.length === 0) {
        return (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
                <Inbox className="h-12 w-12 text-muted-foreground" />
                <div className="text-center">
                    <h3 className="font-medium">No feature requests yet</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Have an idea to improve the app? Submit a feature request!
                    </p>
                </div>
                <Button onClick={openDialog} className="gap-2">
                    <Lightbulb className="h-4 w-4" />
                    Request a Feature
                </Button>
            </div>
        );
    }

    return (
        <div className="container max-w-2xl py-4">
            <div className="mb-4 flex items-center justify-between">
                <h1 className="text-xl font-semibold">My Feature Requests</h1>
                <Button onClick={openDialog} size="sm" className="gap-1">
                    <Lightbulb className="h-4 w-4" />
                    New Request
                </Button>
            </div>

            <div className="space-y-2">
                {requests.map((request) => (
                    <MyRequestCard key={request._id} request={request} />
                ))}
            </div>
        </div>
    );
}
