/**
 * Profile Card Component
 */

import { Button } from '@/client/components/ui/button';
import { Input } from '@/client/components/ui/input';
import { Card } from '@/client/components/ui/card';
import { LinearProgress } from '@/client/components/ui/linear-progress';
import { Camera, Save, X } from 'lucide-react';
import type { UserResponse } from '@/apis/auth/types';

interface ProfileCardProps {
    displayUser: UserResponse;
    username: string;
    setUsername: (value: string) => void;
    previewImage: string | undefined;
    editing: boolean;
    savingProfile: boolean;
    onSave: () => void;
    onCancel: () => void;
    onOpenImageDialog: () => void;
}

export function ProfileCard({
    displayUser,
    username,
    setUsername,
    previewImage,
    editing,
    savingProfile,
    onSave,
    onCancel,
    onOpenImageDialog,
}: ProfileCardProps) {
    return (
        <Card className="flex flex-col items-center p-4">
            <div className="relative">
                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground">
                    {previewImage ? (
                        <img src={previewImage} alt="avatar" className="h-28 w-28 rounded-full object-cover" />
                    ) : (
                        username.charAt(0).toUpperCase()
                    )}
                </div>
                {editing && (
                    <Button variant="secondary" size="sm" className="absolute -right-2 bottom-2" onClick={onOpenImageDialog} disabled={savingProfile}>
                        <Camera className="h-4 w-4" />
                    </Button>
                )}
            </div>
            {editing ? (
                <div className="mt-2 w-full">
                    <Input value={username} onChange={(e) => setUsername(e.target.value)} disabled={savingProfile} />
                </div>
            ) : (
                <>
                    <p className="mt-2 text-xl font-medium">{username}</p>
                    {displayUser.email && <p className="text-sm text-muted-foreground">{displayUser.email}</p>}
                </>
            )}

            {editing && (
                <div className="mt-2 flex justify-center gap-2">
                    <Button onClick={onSave} disabled={savingProfile}>
                        <Save className="mr-2 h-4 w-4" /> Save
                    </Button>
                    {savingProfile && <div className="w-32"><LinearProgress className="mt-1" /></div>}
                    <Button variant="outline" onClick={onCancel} disabled={savingProfile}>
                        <X className="mr-2 h-4 w-4" /> Cancel
                    </Button>
                </div>
            )}
        </Card>
    );
}
