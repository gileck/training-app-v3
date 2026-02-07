/**
 * Bug Fix Route (Legacy Redirect)
 *
 * Redirects /bug-fix/:issueNumber to /decision/:issueNumber
 * preserving query params. This handles old Telegram links.
 */

import { useEffect, useRef } from 'react';
import { useRouter } from '@/client/features';
import { Loader2 } from 'lucide-react';

export function BugFix() {
    const { routeParams, queryParams, navigate } = useRouter();
    const hasRedirected = useRef(false);

    const issueNumber = routeParams.issueNumber;
    const token = queryParams.token;

    useEffect(() => {
        if (!hasRedirected.current) {
            hasRedirected.current = true;
            const targetPath = `/decision/${issueNumber}${token ? `?token=${token}` : ''}`;
            navigate(targetPath, { replace: true });
        }
    }, [issueNumber, token, navigate]);

    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    );
}
