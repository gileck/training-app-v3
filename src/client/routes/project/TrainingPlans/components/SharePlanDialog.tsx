/**
 * Share Plan Dialog
 * 
 * Generates a shareable URL for a training plan and provides
 * copy/native share functionality.
 * 
 * URL format: /share/{token}
 * Token format: base64url(JSON.stringify({ u: userId, p: planId }))
 */

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/client/components/ui/button';
import { Input } from '@/client/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/client/components/ui/dialog';
import { Share2, Copy, Check, ExternalLink } from 'lucide-react';
import { useUser } from '@/client/features/auth';
import { toast } from '@/client/components/ui/toast';

interface SharePlanDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    planId: string;
    planName: string;
}

/**
 * Generate a share URL by encoding userId + planId into a base64url token
 */
function generateShareUrl(userId: string, planId: string): string {
    const payload = JSON.stringify({ u: userId, p: planId });
    // Encode to base64url (URL-safe base64)
    const base64 = btoa(payload);
    const token = base64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    return `${window.location.origin}/share/${token}`;
}

export function SharePlanDialog({
    open,
    onOpenChange,
    planId,
    planName,
}: SharePlanDialogProps) {
    const user = useUser();
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state
    const [copied, setCopied] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- computed share URL
    const [shareUrl, setShareUrl] = useState('');
    
    // Generate share URL when dialog opens
    useEffect(() => {
        if (open && user?.id) {
            setShareUrl(generateShareUrl(user.id, planId));
        }
    }, [open, user?.id, planId]);
    
    // Reset copied state when URL changes
    useEffect(() => {
        setCopied(false);
    }, [shareUrl]);
    
    // Handle copy to clipboard
    const handleCopy = useCallback(async () => {
        if (!shareUrl) return;
        
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            toast.success('Link copied to clipboard!');
            
            // Reset copied state after 2 seconds
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
            toast.error('Could not copy to clipboard. Please select and copy manually.');
        }
    }, [shareUrl]);
    
    // Handle native share (iOS/Android)
    const handleNativeShare = useCallback(async () => {
        if (!shareUrl) return;
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: planName,
                    text: `Check out this training plan: ${planName}`,
                    url: shareUrl,
                });
            } catch (err) {
                // User cancelled or error
                if ((err as Error).name !== 'AbortError') {
                    console.error('Share failed:', err);
                }
            }
        }
    }, [shareUrl, planName]);
    
    // Check if native share is available
    const hasNativeShare = typeof navigator !== 'undefined' && !!navigator.share;
    
    if (!user?.id) {
        return null;
    }
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Share2 className="h-5 w-5 text-primary" />
                        Share Plan
                    </DialogTitle>
                    <DialogDescription>
                        Share &quot;{planName}&quot; with friends. Anyone with the link can view and add this plan.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="py-4 space-y-4">
                    {/* Share URL */}
                    <div className="flex gap-2">
                        <Input
                            value={shareUrl}
                            readOnly
                            className="font-mono text-sm"
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleCopy}
                            className="shrink-0"
                            title="Copy link"
                        >
                            {copied ? (
                                <Check className="h-4 w-4 text-success" />
                            ) : (
                                <Copy className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                    
                    {/* Share Buttons */}
                    <div className="flex flex-col gap-2">
                        <Button
                            onClick={handleCopy}
                            className="w-full"
                        >
                            <Copy className="h-4 w-4 mr-2" />
                            {copied ? 'Copied!' : 'Copy Link'}
                        </Button>

                        {hasNativeShare && (
                            <Button
                                variant="outline"
                                onClick={handleNativeShare}
                                className="w-full"
                            >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Share via...
                            </Button>
                        )}
                    </div>
                    
                    {/* Info */}
                    <p className="text-xs text-muted-foreground text-center">
                        This link can be used by multiple people. The link will stop working if you delete this plan.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
