/**
 * Feature Request Hooks
 *
 * Hooks for submitting feature requests.
 */

import { useMutation } from '@tanstack/react-query';
import { createFeatureRequest } from '@/apis/template/feature-requests/client';
import { useRouter } from '../router';

interface SubmitFeatureRequestData {
    title: string;
    description: string;
    page?: string;
}

export function useSubmitFeatureRequest() {
    const { currentPath } = useRouter();

    return useMutation({
        mutationFn: async (data: SubmitFeatureRequestData) => {
            const response = await createFeatureRequest({
                title: data.title,
                description: data.description,
                page: data.page || currentPath,
            });

            if (response.data?.error) {
                throw new Error(response.data.error);
            }

            return response.data;
        },
    });
}
