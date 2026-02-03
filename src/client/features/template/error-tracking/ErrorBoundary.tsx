/**
 * Error Boundary Component
 * 
 * Catches React component errors and reports them.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { submitErrorReport } from '../bug-report';
import { logger } from '../session-logs';
import { Button } from '@/client/components/template/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/client/components/template/ui/card';
import { AlertCircle, RefreshCw } from 'lucide-react';

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
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-destructive">
                                <AlertCircle className="h-5 w-5" />
                                Something went wrong
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                An unexpected error occurred. This has been automatically reported.
                            </p>
                            {process.env.NODE_ENV === 'development' && this.state.error && (
                                <pre className="mt-4 overflow-auto rounded bg-muted p-2 text-xs">
                                    {this.state.error.message}
                                </pre>
                            )}
                        </CardContent>
                        <CardFooter className="flex gap-2">
                            <Button 
                                variant="outline" 
                                className="flex-1"
                                onClick={this.handleRetry}
                            >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Try Again
                            </Button>
                            <Button 
                                className="flex-1"
                                onClick={this.handleReload}
                            >
                                Reload Page
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}

