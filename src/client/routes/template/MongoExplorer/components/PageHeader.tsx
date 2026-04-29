import { type ReactNode } from 'react';
import { useRouter } from '@/client/features';
import { ChevronRight, Database } from 'lucide-react';
import type { BreadcrumbItem } from '../types';

function BreadcrumbNav({ items }: { items: BreadcrumbItem[] }) {
    const { navigate } = useRouter();

    return (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {items.map((item, index) => (
                <div key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-2">
                    {index > 0 && <ChevronRight className="h-4 w-4" />}
                    {item.path ? (
                        <button
                            type="button"
                            className="min-w-0 break-all rounded px-1 py-0.5 text-left transition-colors hover:bg-muted hover:text-foreground"
                            onClick={() => navigate(item.path!)}
                        >
                            {item.label}
                        </button>
                    ) : (
                        <span className="min-w-0 break-all font-medium text-foreground">
                            {item.label}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
}

export function PageHeader({
    title,
    description,
    breadcrumbs,
    actions,
}: {
    title: string;
    description: string;
    breadcrumbs: BreadcrumbItem[];
    actions: ReactNode[];
}) {
    return (
        <div className="mb-4 space-y-3">
            <BreadcrumbNav items={breadcrumbs} />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <Database className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                        <h1 className="min-w-0 break-all text-xl font-semibold">{title}</h1>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                </div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end [&>*]:flex-1 sm:[&>*]:flex-none">
                    {actions}
                </div>
            </div>
        </div>
    );
}
