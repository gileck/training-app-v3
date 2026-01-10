/**
 * Image Upload Dialog Component
 * Modern dialog for uploading or pasting profile pictures
 */

import { Clipboard, Upload, X } from 'lucide-react';
import { Button } from '@/client/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/client/components/ui/dialog';

interface ImageUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPaste: () => void;
    onUploadClick: () => void;
}

export function ImageUploadDialog({
    open,
    onOpenChange,
    onPaste,
    onUploadClick,
}: ImageUploadDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-center">Change Profile Picture</DialogTitle>
                </DialogHeader>

                <div className="grid gap-3 py-4">
                    {/* Paste from clipboard option */}
                    <button
                        onClick={onPaste}
                        className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50 active:scale-[0.98]"
                    >
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                            <Clipboard className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1">
                            <p className="font-medium text-foreground">Paste from Clipboard</p>
                            <p className="text-sm text-muted-foreground">
                                Use an image you&apos;ve copied
                            </p>
                        </div>
                    </button>

                    {/* Upload image option */}
                    <button
                        onClick={onUploadClick}
                        className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50 active:scale-[0.98]"
                    >
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/10">
                            <Upload className="h-6 w-6 text-secondary" />
                        </div>
                        <div className="flex-1">
                            <p className="font-medium text-foreground">Upload Image</p>
                            <p className="text-sm text-muted-foreground">
                                Choose a file from your device
                            </p>
                        </div>
                    </button>
                </div>

                {/* Cancel button */}
                <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => onOpenChange(false)}
                >
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                </Button>
            </DialogContent>
        </Dialog>
    );
}
