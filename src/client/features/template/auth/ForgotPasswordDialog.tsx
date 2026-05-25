import { FormEvent, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/client/components/template/ui/dialog';
import { Button } from '@/client/components/template/ui/button';
import { Input } from '@/client/components/template/ui/input';
import { Label } from '@/client/components/template/ui/label';
import { useRequestPasswordReset } from './hooks';

interface ForgotPasswordDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialUsername?: string;
}

export function ForgotPasswordDialog({ open, onOpenChange, initialUsername = '' }: ForgotPasswordDialogProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral text input in a dialog form
    const [username, setUsername] = useState(initialUsername);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral submitted state for confirmation screen
    const [submitted, setSubmitted] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- network/offline error message
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const requestResetMutation = useRequestPasswordReset();

    const reset = () => {
        setUsername(initialUsername);
        setSubmitted(false);
        setErrorMessage(null);
    };

    const handleClose = (nextOpen: boolean) => {
        if (!nextOpen) {
            reset();
            requestResetMutation.reset();
        }
        onOpenChange(nextOpen);
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);
        const trimmed = username.trim();
        if (!trimmed) {
            setErrorMessage('Please enter your username.');
            return;
        }

        requestResetMutation.mutate(
            { username: trimmed },
            {
                onSuccess: () => {
                    setSubmitted(true);
                },
                onError: (error) => {
                    setErrorMessage(error.message);
                },
            }
        );
    };

    const isSubmitting = requestResetMutation.isPending;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Forgot Password</DialogTitle>
                    <DialogDescription>
                        {submitted
                            ? 'Check your Telegram for next steps.'
                            : 'Enter your username. If your account has Telegram configured, we’ll send a reset link.'}
                    </DialogDescription>
                </DialogHeader>

                {submitted ? (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            If your account exists and has a Telegram chat ID, you&apos;ll receive a
                            reset link shortly. The link is valid for 30 minutes.
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Didn&apos;t get a message? Your account may not have Telegram configured.
                            Contact the administrator for help.
                        </p>
                        <DialogFooter>
                            <Button onClick={() => handleClose(false)}>Close</Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="forgot-username">Username</Label>
                            <Input
                                id="forgot-username"
                                type="text"
                                autoComplete="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                disabled={isSubmitting}
                                autoFocus
                            />
                        </div>

                        {errorMessage && (
                            <p className="text-sm text-destructive">{errorMessage}</p>
                        )}

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => handleClose(false)}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Sending…' : 'Send reset link'}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
