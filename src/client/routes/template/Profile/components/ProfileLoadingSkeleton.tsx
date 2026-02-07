import { Skeleton } from '@/client/components/template/ui/skeleton';

export function ProfileLoadingSkeleton() {
    return (
        <div className="space-y-6">
            {/* Header skeleton */}
            <div className="flex flex-col items-center rounded-2xl bg-card p-6">
                <Skeleton className="h-28 w-28 rounded-full" />
                <Skeleton className="mt-4 h-7 w-40" />
                <Skeleton className="mt-2 h-5 w-48" />
            </div>

            {/* Section skeletons */}
            {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl bg-card p-4">
                    <Skeleton className="h-5 w-32 mb-4" />
                    <Skeleton className="h-14 w-full" />
                </div>
            ))}
        </div>
    );
}
