/**
 * Profile Header Component
 * Hero-style header with avatar, name, and change photo button
 */

import { Camera, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/ui/avatar';
import { Button } from '@/client/components/ui/button';

interface ProfileHeaderProps {
    username: string;
    email?: string;
    profilePicture?: string;
    isUpdating?: boolean;
    onChangePhoto: () => void;
}

export function ProfileHeader({
    username,
    email,
    profilePicture,
    isUpdating,
    onChangePhoto,
}: ProfileHeaderProps) {
    const initials = username
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <div className="relative overflow-hidden rounded-2xl bg-card border border-border">
            {/* Gradient background accent */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10" />

            <div className="relative flex flex-col items-center px-6 py-8">
                {/* Avatar with camera button */}
                <div className="relative">
                    <Avatar className="h-28 w-28 border-4 border-background shadow-lg">
                        <AvatarImage src={profilePicture} alt={username} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-3xl font-semibold">
                            {initials}
                        </AvatarFallback>
                    </Avatar>

                    {/* Camera button overlay */}
                    <Button
                        size="icon"
                        variant="secondary"
                        className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full shadow-md border-2 border-background"
                        onClick={onChangePhoto}
                        disabled={isUpdating}
                    >
                        {isUpdating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Camera className="h-4 w-4" />
                        )}
                    </Button>
                </div>

                {/* Name and email */}
                <h1 className="mt-4 text-2xl font-semibold text-foreground">
                    {username}
                </h1>
                {email && (
                    <p className="mt-1 text-muted-foreground">
                        {email}
                    </p>
                )}
            </div>
        </div>
    );
}
