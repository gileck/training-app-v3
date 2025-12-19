import { useEffect, useState, useRef, ChangeEvent } from 'react';
import { useAuthStore, useUser } from '@/client/features/auth';
import { useRouter } from '../../router';
import { Button } from '@/client/components/ui/button';
import { Input } from '@/client/components/ui/input';
import { Card } from '@/client/components/ui/card';
import { LinearProgress } from '@/client/components/ui/linear-progress';
import { Alert } from '@/client/components/ui/alert';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/client/components/ui/dialog';
import { Camera, Edit3, Save, X } from 'lucide-react';
import { apiUpdateProfile, apiFetchCurrentUser } from '@/apis/auth/client';
import { UpdateProfileRequest, UserResponse } from '@/apis/auth/types';

export const Profile = () => {
    // Use Zustand store instead of context
    const user = useUser();
    const isValidated = useAuthStore((state) => state.isValidated);
    const isValidating = useAuthStore((state) => state.isValidating);
    const setValidatedUser = useAuthStore((state) => state.setValidatedUser);

    const { navigate } = useRouter();
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral edit mode toggle
    const [editing, setEditing] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- form input before submission
    const [username, setUsername] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral image preview before save
    const [previewImage, setPreviewImage] = useState<string | undefined>(undefined);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral snackbar notification
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [openImageDialog, setOpenImageDialog] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- local loading indicator
    const [savingProfile, setSavingProfile] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- local optimistic user data copy
    const [localUser, setLocalUser] = useState<UserResponse | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- local loading indicator
    const [loadingUserData, setLoadingUserData] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch fresh user data from the server
    const fetchUserData = async () => {
        try {
            setLoadingUserData(true);
            const response = await apiFetchCurrentUser();
            if (response.data?.user) {
                setLocalUser(response.data.user);
                setUsername(response.data.user.username);
                setPreviewImage(response.data.user.profilePicture);
                // Update the global store as well
                setValidatedUser(response.data.user);
            }
        } catch (error) {
            console.error("Failed to fetch user data:", error);
        } finally {
            setLoadingUserData(false);
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
            setUsername(user.username);
            setPreviewImage(user.profilePicture);
        }
    }, [user]);

    if (isValidating || loadingUserData) {
        return (
            <div className="flex h-[80vh] items-center justify-center w-full px-4">
                <LinearProgress />
            </div>
        );
    }

    const handleEditClick = () => {
        // Fetch fresh user data before editing
        setEditing(true);
    };

    const handleCancelEdit = () => {
        setEditing(false);
        // Reset to original values
        if (localUser) {
            setUsername(localUser.username);
            setPreviewImage(localUser.profilePicture);
        }
    };

    const handleSaveProfile = async () => {
        if (!username.trim()) {
            setSnackbar({
                open: true,
                message: 'Username cannot be empty',
                severity: 'error'
            });
            return;
        }

        setSavingProfile(true);

        try {
            const updateData: UpdateProfileRequest = {
                username,
                profilePicture: previewImage !== localUser?.profilePicture ? previewImage : undefined
            };

            const response = await apiUpdateProfile(updateData);

            if (response.data?.success && response.data.user) {
                setLocalUser(response.data.user);
                // Update the global store
                setValidatedUser(response.data.user);
                setEditing(false);
                setSnackbar({
                    open: true,
                    message: 'Profile updated successfully',
                    severity: 'success'
                });
            } else {
                // If the update failed, try to fetch fresh user data
                await fetchUserData();
                setSnackbar({
                    open: true,
                    message: response.data?.error || 'Failed to update profile',
                    severity: 'error'
                });
            }
        } catch (err) {
            // If an error occurred, try to fetch fresh user data
            await fetchUserData();
            const errorMessage = err instanceof Error ? err.message : 'Profile update error';
            setSnackbar({
                open: true,
                message: errorMessage,
                severity: 'error'
            });
        } finally {
            setSavingProfile(false);
        }
    };

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                setPreviewImage(result);
                setOpenImageDialog(false);
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
                        reader.onloadend = () => {
                            const result = reader.result as string;
                            setPreviewImage(result);
                            setOpenImageDialog(false);
                        };
                        reader.readAsDataURL(blob);
                        return;
                    }
                }
            }
            setSnackbar({
                open: true,
                message: 'No image found in clipboard',
                severity: 'error'
            });
        } catch (error) {
            console.error('Error accessing clipboard:', error);
            setSnackbar({
                open: true,
                message: 'Failed to paste image from clipboard',
                severity: 'error'
            });
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleOpenImageDialog = () => {
        setOpenImageDialog(true);
    };

    const handleCloseImageDialog = () => {
        setOpenImageDialog(false);
    };

    // Use localUser for display to prevent the entire app from re-rendering
    const displayUser = localUser || user;

    return (
        <div>
            <div className="mb-3 flex items-center">
                <h1 className="text-2xl font-semibold">My Profile</h1>
                {!editing && (
                    <Button variant="ghost" size="sm" className="ml-2" onClick={handleEditClick}>
                        <Edit3 className="mr-2 h-4 w-4" /> Edit
                    </Button>
                )}
            </div>

            {displayUser && (
                <div className="flex flex-col gap-3 md:flex-row">
                    <div className="w-full md:w-1/3">
                        <Card className="flex flex-col items-center p-4">
                            <div className="relative">
                                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground">
                                    {previewImage ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={previewImage} alt="avatar" className="h-28 w-28 rounded-full object-cover" />
                                    ) : (
                                        username.charAt(0).toUpperCase()
                                    )}
                                </div>
                                {editing && (
                                    <Button variant="secondary" size="sm" className="absolute -right-2 bottom-2" onClick={handleOpenImageDialog} disabled={savingProfile}>
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
                                    <Button onClick={handleSaveProfile} disabled={savingProfile}>
                                        <Save className="mr-2 h-4 w-4" /> Save
                                    </Button>
                                    {savingProfile && <div className="w-32"><LinearProgress className="mt-1" /></div>}
                                    <Button variant="outline" onClick={handleCancelEdit} disabled={savingProfile}>
                                        <X className="mr-2 h-4 w-4" /> Cancel
                                    </Button>
                                </div>
                            )}
                        </Card>
                    </div>

                    <div className="w-full md:w-2/3">
                        <Card className="p-4">
                            <h2 className="mb-2 text-lg font-medium">Account Information</h2>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Username</span>
                                    <span>{username}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Email</span>
                                    <span>{displayUser.email || 'Not provided'}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Member Since</span>
                                    <span>{new Date(displayUser.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* Hidden file input for image upload */}
            <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />

            {/* Image upload dialog */}
            <Dialog open={openImageDialog} onOpenChange={setOpenImageDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Change Profile Picture</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-2">
                        <Button onClick={handlePaste}>Paste from Clipboard</Button>
                        <Button variant="outline" onClick={handleUploadClick}>Upload Image</Button>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleCloseImageDialog}>Cancel</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Snackbar for notifications */}
            {snackbar.open && (
                <div className="fixed bottom-4 left-1/2 z-50 w-[90%] max-w-md -translate-x-1/2">
                    <Alert variant={snackbar.severity === 'success' ? 'success' : 'destructive'}>
                        {snackbar.message}
                    </Alert>
                </div>
            )}
        </div>
    );
};

export default Profile;
