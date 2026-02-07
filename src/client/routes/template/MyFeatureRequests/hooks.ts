import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useQueryDefaults } from '@/client/query';
import { getMyFeatureRequests, addUserComment } from '@/apis/template/feature-requests/client';
import type { FeatureRequestClient, AddUserCommentRequest } from '@/apis/template/feature-requests/types';
import { generateId } from '@/client/utils/id';

/**
 * Hook to fetch the current user's feature requests
 */
export function useMyFeatureRequests() {
    const queryDefaults = useQueryDefaults();

    return useQuery({
        queryKey: ['my-feature-requests'],
        queryFn: async () => {
            const response = await getMyFeatureRequests({});
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data?.featureRequests ?? [];
        },
        ...queryDefaults,
    });
}

/**
 * Hook to add a comment to a feature request
 */
export function useAddComment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (request: AddUserCommentRequest) => {
            const response = await addUserComment(request);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data?.featureRequest;
        },
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: ['my-feature-requests'] });

            const previous = queryClient.getQueryData<FeatureRequestClient[]>(['my-feature-requests']);

            if (previous) {
                const newComment = {
                    id: variables.commentId || generateId(),
                    authorId: 'current-user',
                    authorName: 'You',
                    isAdmin: false,
                    content: variables.content,
                    createdAt: new Date().toISOString(),
                };

                queryClient.setQueryData<FeatureRequestClient[]>(
                    ['my-feature-requests'],
                    previous.map((req) =>
                        req._id === variables.requestId
                            ? { ...req, comments: [...req.comments, newComment] }
                            : req
                    )
                );
            }

            return { previous };
        },
        onError: (_err, _variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(['my-feature-requests'], context.previous);
            }
        },
        onSuccess: () => {},
        onSettled: () => {},
    });
}
