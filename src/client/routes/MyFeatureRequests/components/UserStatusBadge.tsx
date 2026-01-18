import type { FeatureRequestStatus } from '@/apis/feature-requests/types';

interface UserStatusBadgeProps {
    status: FeatureRequestStatus;
}

/**
 * User-friendly status labels (different from admin view)
 */
const userStatusConfig: Record<
    FeatureRequestStatus,
    { label: string; className: string }
> = {
    new: {
        label: 'Submitted',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    },
    in_review: {
        label: 'Under Review',
        className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    },
    product_design: {
        label: 'In Design',
        className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
    },
    tech_design: {
        label: 'In Design',
        className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
    },
    ready_for_dev: {
        label: 'Planned',
        className: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
    },
    in_development: {
        label: 'In Progress',
        className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    },
    ready_for_qa: {
        label: 'Almost Ready',
        className: 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-400',
    },
    done: {
        label: 'Completed',
        className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    },
    rejected: {
        label: 'Not Planned',
        className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    },
    on_hold: {
        label: 'Paused',
        className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    },
};

export function UserStatusBadge({ status }: UserStatusBadgeProps) {
    const config = userStatusConfig[status];

    return (
        <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}
        >
            {config.label}
        </span>
    );
}
