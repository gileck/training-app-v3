import { Badge } from '@/client/components/template/ui/badge';
import { Button } from '@/client/components/template/ui/button';
import { Textarea } from '@/client/components/template/ui/textarea';
import { Loader2, Pencil, Save } from 'lucide-react';

export function RawDocumentCard({
    rawValue,
    rawError,
    isEditing,
    isBusy,
    onStartEdit,
    onChange,
    onCancel,
    onSave,
}: {
    rawValue: string;
    rawError: string | null;
    isEditing: boolean;
    isBusy: boolean;
    onStartEdit: () => void;
    onChange: (nextValue: string) => void;
    onCancel: () => void;
    onSave: () => void;
}) {
    return (
        <div className="overflow-hidden rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <p className="text-sm font-semibold">Raw document</p>
                    <p className="text-sm text-muted-foreground">
                        Edit the full JSON document with schema validation and save confirmation.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={isEditing ? 'default' : 'secondary'}>
                        {isEditing ? 'Editing raw JSON' : 'Read only'}
                    </Badge>
                    {!isEditing && (
                        <Button size="sm" variant="outline" onClick={onStartEdit}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit raw
                        </Button>
                    )}
                </div>
            </div>
            {isEditing ? (
                <div className="space-y-3">
                    <Textarea
                        value={rawValue}
                        onChange={(event) => onChange(event.target.value)}
                        className="min-h-[24rem] font-mono text-xs leading-6"
                        spellCheck={false}
                    />
                    {rawError && <p className="text-xs text-destructive">{rawError}</p>}
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={onSave} disabled={isBusy}>
                            {isBusy ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="mr-2 h-4 w-4" />
                            )}
                            Save raw document
                        </Button>
                        <Button size="sm" variant="outline" onClick={onCancel} disabled={isBusy}>
                            Cancel
                        </Button>
                    </div>
                </div>
            ) : (
                <pre className="overflow-x-auto rounded-xl border border-border bg-muted/20 p-3 font-mono text-xs leading-6">
                    {rawValue}
                </pre>
            )}
        </div>
    );
}
