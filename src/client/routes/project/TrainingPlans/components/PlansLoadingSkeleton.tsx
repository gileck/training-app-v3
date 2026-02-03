import { Card, CardContent } from '@/client/components/template/ui/card';
import { Skeleton } from '@/client/components/template/ui/skeleton';

export function PlansLoadingSkeleton() {
    return (
        <div className="p-4 pb-20 space-y-4">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-semibold">Training Plans</h1>
                <Skeleton className="h-10 w-32" />
            </div>
            {[1, 2, 3].map((i) => (
                <Card key={i} className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                            <div className="space-y-2">
                                <Skeleton className="h-6 w-48" />
                                <Skeleton className="h-4 w-32" />
                            </div>
                            <Skeleton className="h-6 w-16" />
                        </div>
                        <div className="flex gap-2">
                            <Skeleton className="h-9 w-24" />
                            <Skeleton className="h-9 w-24" />
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
