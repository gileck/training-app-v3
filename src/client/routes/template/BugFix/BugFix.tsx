/**
 * Bug Fix Route
 *
 * Public, full-screen route for selecting a fix approach for a bug.
 * Uses query params for issueNumber and token.
 */

import { useRouter } from '@/client/features';
import { BugFixPage } from './BugFixPage';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/client/components/template/ui/alert';

export function BugFix() {
    const { routeParams, queryParams } = useRouter();

    // Get issue number from route params and token from query params
    const issueNumber = routeParams.issueNumber ? Number(routeParams.issueNumber) : null;
    const token = queryParams.token;

    // Validate required parameters
    if (!issueNumber || isNaN(issueNumber) || issueNumber <= 0) {
        return (
            <div className="min-h-screen bg-background p-4">
                <div className="max-w-2xl mx-auto">
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Invalid Issue Number</AlertTitle>
                        <AlertDescription>
                            The issue number must be a positive integer.
                        </AlertDescription>
                    </Alert>
                </div>
            </div>
        );
    }

    if (!token) {
        return (
            <div className="min-h-screen bg-background p-4">
                <div className="max-w-2xl mx-auto">
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Missing Token</AlertTitle>
                        <AlertDescription>
                            Please use the link from Telegram to access this page.
                        </AlertDescription>
                    </Alert>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <BugFixPage issueNumber={issueNumber} token={token} />
        </div>
    );
}
