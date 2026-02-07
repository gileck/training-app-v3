/**
 * Error Boundary Component
 * 
 * Catches React component errors and reports them.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { submitErrorReport } from '../bug-report';
import { logger } from '../session-logs';
import { Button } from '@/client/components/template/ui/button';
import { RefreshCw } from 'lucide-react';
import { ErrorDisplay } from './ErrorDisplay';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log to session logs
        logger.error('error-boundary', `Component error: ${error.message}`, {
            meta: {
                stack: error.stack,
                componentStack: errorInfo.componentStack,
            },
        });

        // Submit error report
        const stackTrace = `${error.stack}\n\nComponent Stack:${errorInfo.componentStack}`;
        submitErrorReport(
            `React Error Boundary: ${error.message}`,
            stackTrace
        ).catch(() => {
            // Silently fail
        });
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex min-h-[400px] items-center justify-center p-4">
                    <div className="w-full max-w-md space-y-3">
                        <ErrorDisplay
                            error={this.state.error}
                            title="Something went wrong"
                            onRetry={this.handleRetry}
                        />
                        <div className="flex justify-center">
                            <Button onClick={this.handleReload}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Reload Page
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

