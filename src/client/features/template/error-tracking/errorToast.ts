/**
 * Error Toast Utilities
 *
 * Wraps toast.error() to add a "Copy Error" action button.
 */

import { toast } from '@/client/components/template/ui/toast';
import { formatErrorForCopy, getUserFriendlyMessage } from './errorUtils';

/** Show an error toast with a "Copy Error" action button */
export function errorToast(userMessage: string, error?: unknown): void {
    toast.error(userMessage, {
        duration: 6000,
        actions: error
            ? [
                  {
                      label: 'Copy Error',
                      onClick: () => {
                          void navigator.clipboard.writeText(formatErrorForCopy(error));
                      },
                  },
              ]
            : undefined,
    });
}

/** Auto-classify the error and show an appropriate toast with Copy action */
export function errorToastAuto(error: unknown, fallback?: string): void {
    const message = getUserFriendlyMessage(error, fallback);
    errorToast(message, error);
}
