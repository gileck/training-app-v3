/**
 * Hook for profile image upload, paste, and save operations.
 */

import { useState, useRef, ChangeEvent } from 'react';
import { apiUpdateProfile } from '@/apis/template/auth/client';
import { UserResponse } from '@/apis/template/auth/types';
import { toast } from '@/client/components/template/ui/toast';

interface UseProfileImageParams {
    onUserUpdate: (user: UserResponse) => void;
    setSavingField: (field: string | null) => void;
}

export function useProfileImage({ onUserUpdate, setSavingField }: UseProfileImageParams) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral image preview before save
    const [previewImage, setPreviewImage] = useState<string | undefined>(undefined);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [openImageDialog, setOpenImageDialog] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSaveProfilePicture = async (imageData: string) => {
        setSavingField('profilePicture');
        try {
            const response = await apiUpdateProfile({ profilePicture: imageData });
            if (response.data?.success && response.data.user) {
                onUserUpdate(response.data.user);
                setPreviewImage(response.data.user.profilePicture);
                toast.success('Profile picture updated');
                return true;
            } else {
                toast.error(response.data?.error || 'Failed to update profile picture');
                return false;
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Profile update error';
            toast.error(errorMessage);
            return false;
        } finally {
            setSavingField(null);
        }
    };

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const result = reader.result as string;
                setPreviewImage(result);
                setOpenImageDialog(false);
                await handleSaveProfilePicture(result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handlePaste = async () => {
        try {
            const clipboardItems = await navigator.clipboard.read();
            for (const clipboardItem of clipboardItems) {
                for (const type of clipboardItem.types) {
                    if (type.startsWith('image/')) {
                        const blob = await clipboardItem.getType(type);
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                            const result = reader.result as string;
                            setPreviewImage(result);
                            setOpenImageDialog(false);
                            await handleSaveProfilePicture(result);
                        };
                        reader.readAsDataURL(blob);
                        return;
                    }
                }
            }
            toast.error('No image found in clipboard');
        } catch (error) {
            console.error('Error accessing clipboard:', error);
            toast.error('Failed to paste image from clipboard');
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    return {
        previewImage,
        setPreviewImage,
        openImageDialog,
        setOpenImageDialog,
        fileInputRef,
        handleFileChange,
        handlePaste,
        handleUploadClick,
    };
}
