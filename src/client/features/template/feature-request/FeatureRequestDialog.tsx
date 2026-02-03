/**
 * Feature Request Dialog
 *
 * Modal dialog for users to submit feature requests.
 */

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
import { Lightbulb, Send, Loader2 } from 'lucide-react';
import { useFeatureRequestStore } from './store';
import { useSubmitFeatureRequest } from './hooks';
import { toast } from '@/client/components/template/ui/toast';
import { useRouter } from '../router';

export function FeatureRequestDialog() {
    const isOpen = useFeatureRequestStore((state) => state.isOpen);
    const closeDialog = useFeatureRequestStore((state) => state.closeDialog);
    const { currentPath } = useRouter();

    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [title, setTitle] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [description, setDescription] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [page, setPage] = useState('');

    const submitMutation = useSubmitFeatureRequest();

    const handleClose = () => {
        setTitle('');
        setDescription('');
        setPage('');
        closeDialog();
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
            await submitMutation.mutateAsync({
                title: title.trim(),
                description: description.trim(),
                page: page.trim() || currentPath,
            });

            handleClose();
            toast.success('Feature request submitted successfully!');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            toast.error(`Failed to submit: ${errorMessage}`);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-yellow-500" />
                        Request a Feature
                    </DialogTitle>
                    <DialogDescription>
                        Have an idea to improve the app? Let us know what you&apos;d like to see.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Title</Label>
                        <Input
                            id="title"
                            placeholder="Brief summary of your feature idea"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={submitMutation.isPending}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            className="min-h-[120px] resize-none"
                            placeholder="Describe what you'd like and why it would be helpful"
                            value={description}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                            disabled={submitMutation.isPending}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="page">Related Page (optional)</Label>
                        <Input
                            id="page"
                            placeholder={currentPath || '/'}
                            value={page}
                            onChange={(e) => setPage(e.target.value)}
                            disabled={submitMutation.isPending}
                        />
                        <p className="text-xs text-muted-foreground">
                            Which page or area does this feature relate to?
                        </p>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={handleClose}
                            disabled={submitMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1"
                            disabled={submitMutation.isPending || !title.trim() || !description.trim()}
                        >
                            {submitMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    <Send className="mr-2 h-4 w-4" />
                                    Submit Request
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
