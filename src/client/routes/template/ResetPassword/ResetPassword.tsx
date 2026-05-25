/**
 * Reset Password Route
 *
 * Public, full-screen page reached via the link sent in the
 * forgot-password Telegram message: /reset-password?token=...
 */

import { FormEvent, useState } from 'react';
import { useRouter } from '@/client/features';
import { useResetPassword } from '@/client/features/template/auth/hooks';
import { Button } from '@/client/components/template/ui/button';
import { Input } from '@/client/components/template/ui/input';
import { Label } from '@/client/components/template/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/client/components/template/ui/alert';
import { AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';

const MIN_PASSWORD_LENGTH = 8;

export function ResetPassword() {
    const { queryParams, navigate } = useRouter();
    const token = typeof queryParams.token === 'string' ? queryParams.token : '';

    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
    const [newPassword, setNewPassword] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
    const [confirmPassword, setConfirmPassword] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form-level validation/network error
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral success-screen flag
    const [done, setDone] = useState(false);

    const resetMutation = useResetPassword();

    if (!token) {
        return (
            <div className="min-h-screen bg-background p-4">
                <div className="mx-auto max-w-md pt-12">
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Missing token</AlertTitle>
                        <AlertDescription>
                            This page requires a reset token. Please use the link sent to your Telegram.
                        </AlertDescription>
                    </Alert>
                </div>
            </div>
        );
    }

    if (done) {
        return (
            <div className="min-h-screen bg-background p-4">
                <div className="mx-auto max-w-md space-y-6 pt-12 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10">
                        <CheckCircle2 className="h-7 w-7 text-success" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold text-foreground">Password reset</h1>
                        <p className="text-sm text-muted-foreground">
                            Your password has been updated. You can now sign in with your new password.
                        </p>
                    </div>
                    <Button onClick={() => navigate('/')} className="w-full">
                        Go to sign in
                    </Button>
                </div>
            </div>
        );
    }

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            setErrorMessage(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
            return;
        }
        if (newPassword !== confirmPassword) {
            setErrorMessage('Passwords do not match.');
            return;
        }

        resetMutation.mutate(
            { token, newPassword },
            {
                onSuccess: () => setDone(true),
                onError: (error) => setErrorMessage(error.message),
            }
        );
    };

    const isSubmitting = resetMutation.isPending;

    return (
        <div className="min-h-screen bg-background p-4">
            <div className="mx-auto max-w-md space-y-6 pt-12">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25">
                        <KeyRound className="h-7 w-7 text-primary-foreground" />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground">Reset password</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Choose a new password for your account.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
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
                            autoFocus
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

                    {errorMessage && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{errorMessage}</AlertDescription>
                        </Alert>
                    )}

                    <Button type="submit" disabled={isSubmitting} className="w-full">
                        {isSubmitting ? 'Resetting…' : 'Reset password'}
                    </Button>
                </form>
            </div>
        </div>
    );
}

export default ResetPassword;
