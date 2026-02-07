/**
 * ErrorDisplay Component
 *
 * Reusable error display with friendly messaging, collapsible details,
 * copy button, and optional retry/back actions.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/client/components/template/ui/card';
import { Button } from '@/client/components/template/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/client/components/template/ui/collapsible';
import { AlertCircle, WifiOff, Copy, CheckCheck, ChevronDown, ChevronUp, RefreshCw, ArrowLeft } from 'lucide-react';
import { isNetworkError, cleanErrorMessage, formatErrorForCopy } from './errorUtils';
import { useIsAdmin } from '../auth/store';

interface ErrorDisplayProps {
    error: unknown;
    title?: string;
    onRetry?: () => void;
    onBack?: () => void;
    backLabel?: string;
    variant?: 'card' | 'inline';
}

export function ErrorDisplay({
    error,
    title = 'Something went wrong',
    onRetry,
    onBack,
    backLabel = 'Go Back',
    variant = 'card',
}: ErrorDisplayProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state for collapsible
    const [detailsOpen, setDetailsOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state for copy feedback
    const [copied, setCopied] = useState(false);

    const isAdmin = useIsAdmin();
    const networkError = isNetworkError(error);
    const Icon = networkError ? WifiOff : AlertCircle;
    const errorMessage = cleanErrorMessage(error);
    const stack = isAdmin && error instanceof Error ? error.stack : undefined;

    const handleCopy = () => {
        const copyText = isAdmin ? formatErrorForCopy(error) : `Error: ${errorMessage}`;
        void navigator.clipboard.writeText(copyText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const content = (
        <div className="flex flex-col items-center text-center">
            <Icon className="h-12 w-12 text-destructive" />
            <p className="mt-4 font-medium text-destructive">{title}</p>

            <div className="mt-4 w-full space-y-3">
                {/* Collapsible error details */}
                <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
                    <CollapsibleTrigger className="flex items-center gap-2 mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors">
                        {detailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        <span>Error Details</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3 space-y-3 text-left">
                        <div className="rounded-md bg-destructive/10 p-4">
                            <p className="text-sm font-medium text-destructive">Error Message:</p>
                            <p className="mt-1 text-sm text-foreground">{errorMessage}</p>
                        </div>
                        {stack && (
                            <div className="rounded-md bg-muted p-4">
                                <p className="text-sm font-medium text-muted-foreground">Stack Trace:</p>
                                <pre className="mt-1 overflow-x-auto text-xs text-muted-foreground whitespace-pre-wrap break-all">
                                    {stack}
                                </pre>
                            </div>
                        )}
                    </CollapsibleContent>
                </Collapsible>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopy}>
                        {copied ? (
                            <>
                                <CheckCheck className="mr-2 h-4 w-4" />
                                Copied
                            </>
                        ) : (
                            <>
                                <Copy className="mr-2 h-4 w-4" />
                                Copy Error
                            </>
                        )}
                    </Button>
                    {onRetry && (
                        <Button variant="outline" size="sm" onClick={onRetry}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Retry
                        </Button>
                    )}
                    {onBack && (
                        <Button variant="outline" size="sm" onClick={onBack}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            {backLabel}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );

    if (variant === 'inline') {
        return <div className="py-6">{content}</div>;
    }

    return (
        <Card>
            <CardContent className="py-8">{content}</CardContent>
        </Card>
    );
}
