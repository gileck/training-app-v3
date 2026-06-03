/**
 * Admin Users Route Hooks
 *
 * Lists all users and generates per-user passkey-enrollment links. Generating
 * a link is a server action (not an optimistic mutation) — it returns the URL
 * the admin hands to the user.
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { apiListUsers, apiGeneratePasskeyLink } from '@/apis/template/admin-users/client';
import type {
    AdminUserSummary,
    GeneratePasskeyLinkResponse,
} from '@/apis/template/admin-users/types';
import { useQueryDefaults } from '@/client/query';

const adminUsersQueryKey = ['admin-users', 'list'] as const;

export function useAdminUsers() {
    const queryDefaults = useQueryDefaults();
    return useQuery({
        ...queryDefaults,
        queryKey: adminUsersQueryKey,
        queryFn: async (): Promise<AdminUserSummary[]> => {
            const result = await apiListUsers();
            if (result.data?.error) {
                throw new Error(result.data.error);
            }
            return result.data?.users ?? [];
        },
    });
}

export interface GeneratedLink {
    url: string;
    expiresAt?: string;
}

export function useGeneratePasskeyLink() {
    return useMutation<GeneratedLink, Error, { userId: string }>({
        mutationFn: async ({ userId }): Promise<GeneratedLink> => {
            const result = await apiGeneratePasskeyLink({ userId });
            const data: GeneratePasskeyLinkResponse | undefined = result.data;
            if (!data || Object.keys(data).length === 0) {
                throw new Error('You must be online to generate a link');
            }
            if (data.error) {
                throw new Error(data.error);
            }
            if (!data.url) {
                throw new Error('Failed to generate link');
            }
            return { url: data.url, expiresAt: data.expiresAt };
        },
    });
}
