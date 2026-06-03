import { Loader2, Copy, RefreshCw, Link2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/client/components/template/ui/dialog';
import { Button } from '@/client/components/template/ui/button';
import { toast } from '@/client/components/template/ui/toast';
import { copyTextToClipboard } from '@/client/utils/clipboard';
import type { GeneratedLink } from '../hooks';

interface PasskeyLinkDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    username: string | null;
    isLoading: boolean;
    link: GeneratedLink | null;
    onRegenerate: () => void;
}

function formatExpiry(iso?: string): string | null {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString();
}

export function PasskeyLinkDialog({
    open,
    onOpenChange,
    username,
    isLoading,
    link,
    onRegenerate,
}: PasskeyLinkDialogProps) {
    const handleCopy = async () => {
        if (!link) return;
        const ok = await copyTextToClipboard(link.url);
        if (ok) {
            toast.success('Link copied');
        } else {
            toast.error('Could not copy — select and copy manually');
        }
    };

    const expiry = formatExpiry(link?.expiresAt);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Passkey enrollment link</DialogTitle>
                    <DialogDescription>
                        {username
                            ? `Send this one-time link to ${username}. Opening it lets them register a passkey on their device.`
                            : 'One-time link to register a passkey.'}
                    </DialogDescription>
                </DialogHeader>

                {isLoading || !link ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
                            <Link2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                            <p className="break-all text-sm text-foreground select-all">{link.url}</p>
                        </div>
                        {expiry && (
                            <p className="text-xs text-muted-foreground">
                                Expires {expiry}. Generating a new link invalidates this one.
                            </p>
                        )}
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Button type="button" onClick={handleCopy} className="min-h-11 flex-1">
                                <Copy className="mr-2 h-4 w-4" />
                                Copy link
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onRegenerate}
                                className="min-h-11"
                            >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Regenerate
                            </Button>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
