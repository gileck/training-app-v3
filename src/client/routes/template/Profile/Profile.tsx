/**
 * Profile Page Component
 * Modern iOS-inspired profile page with inline editing
 */

import { useEffect, useState } from 'react';
import { useAuthStore, useUser, useCurrentUser } from '@/client/features';
import { useRouter } from '@/client/features';
import { apiUpdateProfile } from '@/apis/template/auth/client';
import { UpdateProfileRequest, UserResponse } from '@/apis/template/auth/types';
import { toast } from '@/client/components/template/ui/toast';
import { ProfileHeader } from './components/ProfileHeader';
import { ProfileSection } from './components/ProfileSection';
import { EditableField } from './components/EditableField';
import { ImageUploadDialog } from './components/ImageUploadDialog';
import { ProfileLoadingSkeleton } from './components/ProfileLoadingSkeleton';
import { useProfileImage } from './useProfileImage';
import { Bell, Calendar, Info, Lock, Mail, MessageSquare, User } from 'lucide-react';
import { Switch } from '@/client/components/template/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/client/components/template/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/client/components/template/ui/dialog';
import type { TwoFactorMethod } from '@/apis/template/auth/types';

export const Profile = () => {
    const user = useUser();
    const isValidated = useAuthStore((state) => state.isValidated);
    const isValidating = useAuthStore((state) => state.isValidating);
    const setValidatedUser = useAuthStore((state) => state.setValidatedUser);

    // React Query hook for fetching/refetching user data
    const { refetch: refetchUser } = useCurrentUser();

    const { navigate } = useRouter();

    // eslint-disable-next-line state-management/prefer-state-architecture -- local optimistic user data copy
    const [localUser, setLocalUser] = useState<UserResponse | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- track which field is being saved
    const [savingField, setSavingField] = useState<string | null>(null);

    const handleUserUpdate = (updatedUser: UserResponse) => {
        setLocalUser(updatedUser);
        setValidatedUser(updatedUser);
    };

    const {
        previewImage,
        setPreviewImage,
        openImageDialog,
        setOpenImageDialog,
        fileInputRef,
        handleFileChange,
        handlePaste,
        handleUploadClick,
    } = useProfileImage({ onUserUpdate: handleUserUpdate, setSavingField });

    // Refetch user data using React Query and sync to auth store
    const fetchUserData = async () => {
        const result = await refetchUser();
        if (result.data?.user) {
            setLocalUser(result.data.user);
            setPreviewImage(result.data.user.profilePicture);
            setValidatedUser(result.data.user);
        }
    };

    useEffect(() => {
        if (!isValidating && !isValidated && !user) {
            navigate('/login');
        }
    }, [isValidated, isValidating, user, navigate]);

    useEffect(() => {
        if (user) {
            setLocalUser(user);
            setPreviewImage(user.profilePicture);
        }
    }, [user, setPreviewImage]);

    const handleSaveField = async (field: keyof UpdateProfileRequest, value: string | boolean) => {
        if (field === 'username' && typeof value === 'string' && !value.trim()) {
            toast.error('Username cannot be empty');
            return false;
        }

        setSavingField(field);

        try {
            const updateData: UpdateProfileRequest = {
                [field]: value,
            };

            const response = await apiUpdateProfile(updateData);

            if (response.data?.success && response.data.user) {
                setLocalUser(response.data.user);
                setValidatedUser(response.data.user);
                toast.success('Profile updated');
                return true;
            } else {
                await fetchUserData();
                toast.error(response.data?.error || 'Failed to update profile');
                return false;
            }
        } catch (err) {
            await fetchUserData();
            const errorMessage = err instanceof Error ? err.message : 'Profile update error';
            toast.error(errorMessage);
            return false;
        } finally {
            setSavingField(null);
        }
    };

    const displayUser = localUser || user;

    if (isValidating) {
        return (
            <div className="mx-auto max-w-2xl px-4 py-6">
                <ProfileLoadingSkeleton />
            </div>
        );
    }

    if (!displayUser) {
        return null;
    }

    const memberSince = new Date(displayUser.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    const availableTwoFactorMethods: TwoFactorMethod[] = [
        ...(displayUser.email ? ['email' as const] : []),
        ...(displayUser.telegramChatId ? ['telegram' as const] : []),
    ];
    const selectedTwoFactorMethod = displayUser.twoFactorMethod
        || (displayUser.email ? 'email' : displayUser.telegramChatId ? 'telegram' : undefined);

    return (
        <div className="mx-auto max-w-2xl px-4 py-6">
            <ProfileHeader
                username={displayUser.username}
                email={displayUser.email}
                profilePicture={previewImage}
                isUpdating={savingField === 'profilePicture'}
                onChangePhoto={() => setOpenImageDialog(true)}
            />

            <div className="mt-6 space-y-4">
                <ProfileSection title="Personal Information" icon={<User className="h-5 w-5" />}>
                    <EditableField
                        label="Username"
                        value={displayUser.username}
                        icon={<User className="h-4 w-4" />}
                        readOnly
                    />
                    <EditableField
                        label="Email"
                        value={displayUser.email || ''}
                        icon={<Mail className="h-4 w-4" />}
                        onSave={(value) => handleSaveField('email', value)}
                        isSaving={savingField === 'email'}
                        placeholder="Add email address"
                    />
                </ProfileSection>

                <ProfileSection title="Notifications" icon={<Bell className="h-5 w-5" />}>
                    <div className="flex items-center justify-between px-4 py-3.5">
                        <div className="flex items-center gap-3">
                            <Bell className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Enable Notifications</span>
                        </div>
                        <Switch
                            checked={displayUser.notificationsEnabled ?? false}
                            onCheckedChange={(checked) => handleSaveField('notificationsEnabled', checked)}
                            disabled={savingField === 'notificationsEnabled'}
                        />
                    </div>

                </ProfileSection>

                <ProfileSection title="Telegram" icon={<MessageSquare className="h-5 w-5" />}>
                    <EditableField
                        label="Telegram Chat ID"
                        value={displayUser.telegramChatId || ''}
                        icon={<MessageSquare className="h-4 w-4" />}
                        onSave={(value) => handleSaveField('telegramChatId', value)}
                        isSaving={savingField === 'telegramChatId'}
                        placeholder="Enter chat ID for Telegram 2-factor approval"
                        infoTitle="How to Get Your Telegram Chat ID"
                        infoContent={
                            <ol className="ml-4 list-decimal space-y-2 text-sm text-muted-foreground">
                                <li>Open <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-primary underline">@userinfobot</a> on Telegram</li>
                                <li>Start a chat and send any message</li>
                                <li>The bot will reply with your Chat ID</li>
                                <li>Copy the ID number and paste it in the field</li>
                                <li>This chat ID is used when Telegram is selected as your 2-factor method</li>
                            </ol>
                        }
                    />
                </ProfileSection>

                <ProfileSection title="2-Factor Authentication" icon={<Lock className="h-5 w-5" />}>
                    <div className="flex items-center justify-between px-4 py-3.5">
                        <div className="flex items-center gap-3">
                            <Lock className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                    Enable 2-Factor Authentication
                                    <InfoDialog
                                        title="2-Factor Authentication"
                                        description="Require a second approval step after password sign-in. Default is off"
                                    />
                                </span>
                            </div>
                        </div>
                        <Switch
                            checked={displayUser.twoFactorEnabled ?? false}
                            onCheckedChange={(checked) => handleSaveField('twoFactorEnabled', checked)}
                            disabled={savingField === 'twoFactorEnabled' || availableTwoFactorMethods.length === 0}
                        />
                    </div>

                    <div className="space-y-2 px-4 pb-3">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                                    Approval Method
                                    <InfoDialog
                                        title="Approval Method"
                                        description="Choose whether sign-in approvals are sent by email or Telegram."
                                    />
                                </p>
                            </div>
                            <div className="w-40">
                                <Select
                                    value={selectedTwoFactorMethod}
                                    onValueChange={(value) => handleSaveField('twoFactorMethod', value)}
                                    disabled={savingField === 'twoFactorMethod' || availableTwoFactorMethods.length === 0}
                                >
                                    <SelectTrigger className="h-10 text-sm">
                                        <SelectValue placeholder="Choose method" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {displayUser.email && (
                                            <SelectItem value="email">Email</SelectItem>
                                        )}
                                        {displayUser.telegramChatId && (
                                            <SelectItem value="telegram">Telegram</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {availableTwoFactorMethods.length === 0 && (
                        <p className="px-4 pb-3 text-xs text-muted-foreground">
                            Add an email address or Telegram chat ID before enabling 2-factor authentication.
                        </p>
                    )}

                    {availableTwoFactorMethods.length > 0 && !displayUser.twoFactorEnabled && (
                        <p className="px-4 pb-3 text-xs text-muted-foreground">
                            {selectedTwoFactorMethod === 'telegram'
                                ? 'Telegram approval will use the chat ID configured above.'
                                : 'Email approval will use the email address in Personal Information.'}
                        </p>
                    )}
                </ProfileSection>

                <ProfileSection title="Account" icon={<Calendar className="h-5 w-5" />}>
                    <EditableField
                        label="Member Since"
                        value={memberSince}
                        icon={<Calendar className="h-4 w-4" />}
                        readOnly
                    />
                </ProfileSection>
            </div>

            {/* Hidden file input for image upload */}
            <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />

            {/* Image upload dialog */}
            <ImageUploadDialog
                open={openImageDialog}
                onOpenChange={setOpenImageDialog}
                onPaste={handlePaste}
                onUploadClick={handleUploadClick}
            />
        </div>
    );
};

export default Profile;

function InfoDialog({ title, description }: { title: string; description: string }) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation();
                        }
                    }}
                    className="cursor-pointer text-muted-foreground/60 hover:text-muted-foreground"
                >
                    <Info className="h-3.5 w-3.5" />
                </span>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {description}
                </p>
            </DialogContent>
        </Dialog>
    );
}
