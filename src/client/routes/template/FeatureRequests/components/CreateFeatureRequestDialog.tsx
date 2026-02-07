import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/client/components/template/ui/dialog';
import { Button } from '@/client/components/template/ui/button';
import { Label } from '@/client/components/template/ui/label';
import { Input } from '@/client/components/template/ui/input';
import { Textarea } from '@/client/components/template/ui/textarea';
import { Lightbulb, Loader2, Send } from 'lucide-react';
import { toast } from '@/client/components/template/ui/toast';
import { useCreateFeatureRequest } from '../hooks';

interface CreateFeatureRequestDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateFeatureRequestDialog({ open, onOpenChange }: CreateFeatureRequestDialogProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [title, setTitle] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [description, setDescription] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [page, setPage] = useState('');

    const createMutation = useCreateFeatureRequest();

    const handleClose = () => {
        setTitle('');
        setDescription('');
        setPage('');
        onOpenChange(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) {
            toast.error('Please enter a title');
            return;
        }

        if (!description.trim()) {
            toast.error('Please enter a description');
            return;
        }

        try {
            await createMutation.mutateAsync({
                title: title.trim(),
                description: description.trim(),
                page: page.trim() || undefined,
            });
            handleClose();
        } catch (error) {
            console.error('Create feature request failed:', error);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(isOpen) => {
                if (!isOpen && !createMutation.isPending) {
                    handleClose();
                }
            }}
        >
            <DialogContent className="mx-4 max-w-[calc(100vw-2rem)] sm:mx-auto sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-yellow-500" />
                        New Feature Request
                    </DialogTitle>
                    <DialogDescription>
                        Create a new feature request for the admin dashboard.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Title</Label>
                        <Input
                            id="title"
                            placeholder="Brief summary of the feature"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={createMutation.isPending}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            className="min-h-[120px] resize-none"
                            placeholder="Describe the feature request in detail"
                            value={description}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                            disabled={createMutation.isPending}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="page">Related Page (optional)</Label>
                        <Input
                            id="page"
                            placeholder="/admin/feature-requests"
                            value={page}
                            onChange={(e) => setPage(e.target.value)}
                            disabled={createMutation.isPending}
                        />
                        <p className="text-xs text-muted-foreground">
                            Which page or area does this feature relate to?
                        </p>
                    </div>

                    <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full sm:flex-1"
                            onClick={handleClose}
                            disabled={createMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="w-full sm:flex-1"
                            disabled={createMutation.isPending || !title.trim() || !description.trim()}
                        >
                            {createMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Send className="mr-2 h-4 w-4" />
                                    Create Request
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
