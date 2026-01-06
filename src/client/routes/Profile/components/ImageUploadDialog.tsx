/**
 * Image Upload Dialog Component
 */

import { Button } from '@/client/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/client/components/ui/dialog';

interface ImageUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPaste: () => void;
    onUploadClick: () => void;
}

export function ImageUploadDialog({ open, onOpenChange, onPaste, onUploadClick }: ImageUploadDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Change Profile Picture</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-2">
                    <Button onClick={onPaste}>Paste from Clipboard</Button>
                    <Button variant="outline" onClick={onUploadClick}>Upload Image</Button>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
