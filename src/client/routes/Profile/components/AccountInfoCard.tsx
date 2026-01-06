/**
 * Account Info Card Component
 */

import { Card } from '@/client/components/ui/card';
import type { UserResponse } from '@/apis/auth/types';

interface AccountInfoCardProps {
    displayUser: UserResponse;
    username: string;
}

export function AccountInfoCard({ displayUser, username }: AccountInfoCardProps) {
    return (
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
    );
}
