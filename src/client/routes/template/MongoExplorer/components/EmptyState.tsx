import { FileJson } from 'lucide-react';

export function EmptyState({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-4 py-12 text-center">
            <FileJson className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-base font-medium">{title}</p>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">{description}</p>
        </div>
    );
}
