/**
 * User Approvals Page
 *
 * Admin-only page for reviewing and acting on pending signups.
 * Only reachable when `authOverrides.requireAdminApproval` is enabled and
 * the current user is the admin — the router enforces this via the
 * /admin/* path convention.
 */

import { useState } from 'react';
import { Loader2, UserCheck, UserX, Mail, Clock } from 'lucide-react';
import { Card, CardContent } from '@/client/components/template/ui/card';
import { Button } from '@/client/components/template/ui/button';
import { ConfirmDialog } from '@/client/components/template/ui/confirm-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/client/components/template/ui/alert';
import { AlertCircle } from 'lucide-react';
import { usePendingUsers, useApproveUser, useRejectUser } from './hooks';
import type { PendingUser } from '@/apis/template/user-approvals/types';

export function UserApprovals() {
    const { data: pending, isLoading, error } = usePendingUsers();
    const approveMutation = useApproveUser();
    const rejectMutation = useRejectUser();

    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral confirm dialog target
    const [rejectTarget, setRejectTarget] = useState<PendingUser | null>(null);

    const handleApprove = (user: PendingUser) => {
        approveMutation.mutate(user.id);
    };

    const handleRequestReject = (user: PendingUser) => {
        setRejectTarget(user);
    };

    const handleConfirmReject = () => {
        if (!rejectTarget) return;
        rejectMutation.mutate(rejectTarget.id);
        setRejectTarget(null);
    };

    return (
        <div className="mx-auto w-full max-w-2xl px-4 py-6 pb-20 sm:py-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-foreground">Pending Approvals</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Review signups awaiting approval. Approve to let them log in,
                    or reject to block their access.
                </p>
            </div>

            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            )}

            {!isLoading && error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Failed to load pending users</AlertTitle>
                    <AlertDescription>
                        {error instanceof Error ? error.message : 'Unknown error'}
                    </AlertDescription>
                </Alert>
            )}

            {!isLoading && !error && pending !== undefined && pending.length === 0 && (
                <Card>
                    <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                        <UserCheck className="h-10 w-10 text-muted-foreground" />
                        <p className="text-base font-medium text-foreground">All caught up</p>
                        <p className="text-sm text-muted-foreground">
                            There are no signups waiting for approval.
                        </p>
                    </CardContent>
                </Card>
            )}

            {!isLoading && !error && pending && pending.length > 0 && (
                <ul className="flex flex-col gap-3">
                    {pending.map((user) => (
                        <li key={user.id}>
                            <PendingUserCard
                                user={user}
                                onApprove={handleApprove}
                                onReject={handleRequestReject}
                            />
                        </li>
                    ))}
                </ul>
            )}

            <ConfirmDialog
                open={rejectTarget !== null}
                onOpenChange={(open) => !open && setRejectTarget(null)}
                title="Reject this signup?"
                description={
                    rejectTarget
                        ? `${rejectTarget.username} will be blocked from logging in. The username and email stay reserved.`
                        : ''
                }
                confirmText="Reject"
                cancelText="Cancel"
                variant="destructive"
                onConfirm={handleConfirmReject}
            />
        </div>
    );
}

interface PendingUserCardProps {
    user: PendingUser;
    onApprove: (user: PendingUser) => void;
    onReject: (user: PendingUser) => void;
}

function PendingUserCard({ user, onApprove, onReject }: PendingUserCardProps) {
    const createdDate = new Date(user.createdAt);
    const createdLabel = Number.isNaN(createdDate.getTime())
        ? user.createdAt
        : createdDate.toLocaleString();

    return (
        <Card>
            <CardContent className="flex flex-col gap-4 p-4">
                <div className="flex flex-col gap-1">
                    <p className="text-base font-semibold text-foreground break-words">
                        {user.username}
                    </p>
                    {user.email && (
                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground break-all">
                            <Mail className="h-4 w-4 flex-shrink-0" />
                            <span>{user.email}</span>
                        </p>
                    )}
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>Signed up {createdLabel}</span>
                    </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                        type="button"
                        onClick={() => onApprove(user)}
                        className="min-h-11 flex-1"
                    >
                        <UserCheck className="mr-2 h-4 w-4" />
                        Approve
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onReject(user)}
                        className="min-h-11 flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                        <UserX className="mr-2 h-4 w-4" />
                        Reject
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
