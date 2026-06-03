/**
 * Admin Users Page
 *
 * Admin-only page listing all users. Per user, the admin can generate a
 * one-time passkey-enrollment link to hand off (the same link email would
 * send once SES is wired). Reachable at /admin/users; gated by the /admin/*
 * path convention.
 */

import { useState } from 'react';
import { Loader2, Mail, KeyRound, Fingerprint, AlertCircle, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/client/components/template/ui/card';
import { Button } from '@/client/components/template/ui/button';
import { Badge } from '@/client/components/template/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/client/components/template/ui/alert';
import { errorToast } from '@/client/features/template/error-tracking';
import { useAdminUsers, useGeneratePasskeyLink, type GeneratedLink } from './hooks';
import { PasskeyLinkDialog } from './components/PasskeyLinkDialog';
import type { AdminUserSummary } from '@/apis/template/admin-users/types';

export function AdminUsers() {
    const { data: users, isLoading, error } = useAdminUsers();
    const generateLink = useGeneratePasskeyLink();

    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog target
    const [linkUser, setLinkUser] = useState<AdminUserSummary | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog content for the open link dialog
    const [generated, setGenerated] = useState<GeneratedLink | null>(null);

    const runGenerate = (user: AdminUserSummary) => {
        setLinkUser(user);
        setGenerated(null);
        generateLink.mutate(
            { userId: user.id },
            {
                onSuccess: (link) => setGenerated(link),
                onError: (err) => {
                    errorToast(err.message, err);
                    setLinkUser(null);
                },
            }
        );
    };

    return (
        <div className="mx-auto w-full max-w-2xl px-4 py-6 pb-20 sm:py-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-foreground">Users</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Generate a one-time passkey-enrollment link for any user and send it to them.
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
                    <AlertTitle>Failed to load users</AlertTitle>
                    <AlertDescription>
                        {error instanceof Error ? error.message : 'Unknown error'}
                    </AlertDescription>
                </Alert>
            )}

            {!isLoading && !error && users !== undefined && users.length === 0 && (
                <Card>
                    <CardContent className="py-12 text-center text-sm text-muted-foreground">
                        No users yet.
                    </CardContent>
                </Card>
            )}

            {!isLoading && !error && users && users.length > 0 && (
                <ul className="flex flex-col gap-3">
                    {users.map((user) => (
                        <li key={user.id}>
                            <UserCard
                                user={user}
                                onGenerate={runGenerate}
                                generating={generateLink.isPending && linkUser?.id === user.id}
                            />
                        </li>
                    ))}
                </ul>
            )}

            <PasskeyLinkDialog
                open={linkUser !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setLinkUser(null);
                        setGenerated(null);
                    }
                }}
                username={linkUser?.username ?? null}
                isLoading={generateLink.isPending}
                link={generated}
                onRegenerate={() => linkUser && runGenerate(linkUser)}
            />
        </div>
    );
}

interface UserCardProps {
    user: AdminUserSummary;
    onGenerate: (user: AdminUserSummary) => void;
    generating: boolean;
}

function UserCard({ user, onGenerate, generating }: UserCardProps) {
    return (
        <Card>
            <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-foreground break-words">
                            {user.username}
                        </p>
                        {user.isAdmin && <Badge variant="secondary">Admin</Badge>}
                        {user.approvalStatus === 'pending' && <Badge variant="outline">Pending</Badge>}
                        {user.approvalStatus === 'rejected' && (
                            <Badge variant="destructive">Rejected</Badge>
                        )}
                    </div>
                    {user.email && (
                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground break-all">
                            <Mail className="h-4 w-4 flex-shrink-0" />
                            <span>{user.email}</span>
                        </p>
                    )}
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Fingerprint className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>
                            {user.passkeyCount
                                ? `${user.passkeyCount} passkey${user.passkeyCount === 1 ? '' : 's'}`
                                : 'No passkeys yet'}
                        </span>
                        {!!user.passkeyCount && <ShieldCheck className="h-3.5 w-3.5 text-success" />}
                    </p>
                </div>

                <Button
                    type="button"
                    variant="outline"
                    onClick={() => onGenerate(user)}
                    disabled={generating}
                    className="min-h-11"
                >
                    {generating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <KeyRound className="mr-2 h-4 w-4" />
                    )}
                    {generating ? 'Generating…' : 'Generate passkey link'}
                </Button>
            </CardContent>
        </Card>
    );
}
