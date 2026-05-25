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
import { toast } from '@/client/components/template/ui/toast';
import { errorToast } from '@/client/features/template/error-tracking';
import { useChangePassword } from '@/client/features';

const MIN_PASSWORD_LENGTH = 8;

interface ChangePasswordDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral text inputs in a dialog form
    const [currentPassword, setCurrentPassword] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral text inputs in a dialog form
    const [newPassword, setNewPassword] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral text inputs in a dialog form
    const [confirmPassword, setConfirmPassword] = useState('');

    const changePasswordMutation = useChangePassword();

    const reset = () => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
    };

    const handleClose = (nextOpen: boolean) => {
        if (!nextOpen) {
            reset();
        }
        onOpenChange(nextOpen);
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();

        if (!currentPassword || !newPassword) {
            toast.error('Please fill in all fields');
            return;
        }
        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            toast.error(`New password must be at least ${MIN_PASSWORD_LENGTH} characters`);
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error('New password and confirmation do not match');
            return;
        }
        if (newPassword === currentPassword) {
            toast.error('New password must be different from current password');
            return;
        }

        changePasswordMutation.mutate(
            { currentPassword, newPassword },
            {
                onSuccess: () => {
                    toast.success('Password changed');
                    reset();
                    onOpenChange(false);
                },
                onError: (error) => {
                    errorToast(error.message, error);
                },
            }
        );
    };

    const isSubmitting = changePasswordMutation.isPending;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Change Password</DialogTitle>
                    <DialogDescription>
                        Enter your current password and choose a new one.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="current-password">Current password</Label>
                        <Input
                            id="current-password"
                            type="password"
                            autoComplete="current-password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            disabled={isSubmitting}
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="new-password">New password</Label>
                        <Input
                            id="new-password"
                            type="password"
                            autoComplete="new-password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            disabled={isSubmitting}
                            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirm new password</Label>
                        <Input
                            id="confirm-password"
                            type="password"
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={isSubmitting}
                        />
                    </div>

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
                            {isSubmitting ? 'Changing…' : 'Change password'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
