/**
 * Decision Page Component
 *
 * Generic decision page that displays agent-provided options
 * and allows admin to select one or provide a custom solution.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getDecision } from '@/apis/template/agent-decision/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/template/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/client/components/template/ui/alert';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/client/components/template/ui/collapsible';
import { AlertCircle, Loader2, Check, ChevronDown, ChevronUp, GitBranch } from 'lucide-react';
import { DecisionForm } from './DecisionForm';

interface DecisionPageProps {
    issueNumber: number;
    token: string;
}

export function DecisionPage({ issueNumber, token }: DecisionPageProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state for form submission status
    const [submitted, setSubmitted] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state for collapsible
    const [contextOpen, setContextOpen] = useState(true);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state for routed destination
    const [routedTo, setRoutedTo] = useState<string | undefined>();

    const {
        data: decisionResponse,
        isLoading,
        error: fetchError,
    } = useQuery({
        queryKey: ['agent-decision', issueNumber, token],
        queryFn: async () => {
            const response = await getDecision({ issueNumber, token });
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        staleTime: Infinity,
        retry: false,
    });

    const decision = decisionResponse?.decision;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (fetchError || decisionResponse?.error) {
        const errorMessage = fetchError?.message || decisionResponse?.error || 'Unknown error';
        return (
            <div className="p-3 sm:p-4 max-w-2xl mx-auto">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            </div>
        );
    }

    if (!decision) {
        return (
            <div className="p-3 sm:p-4 max-w-2xl mx-auto">
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Not Found</AlertTitle>
                    <AlertDescription>
                        No agent decision found for issue #{issueNumber}.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="p-3 sm:p-4 max-w-2xl mx-auto">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <Check className="h-12 w-12 text-primary" />
                            <div className="space-y-2">
                                <h2 className="text-xl font-semibold text-foreground">
                                    Decision Submitted!
                                </h2>
                                <p className="text-muted-foreground">
                                    {routedTo
                                        ? `Issue #${issueNumber} has been routed to ${routedTo}.`
                                        : `Your selection for issue #${issueNumber} has been recorded.`
                                    }
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    The agent will process this in the next workflow run.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-3 sm:p-4 pb-24 max-w-2xl mx-auto space-y-4">
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    <GitBranch className="h-5 w-5 text-primary shrink-0" />
                    <h1 className="text-lg sm:text-xl font-bold text-foreground">
                        Agent Decision
                    </h1>
                </div>
                <p className="text-sm text-muted-foreground">
                    Issue #{issueNumber}: {decision.issueTitle}
                </p>
            </div>

            {decision.context && (
                <Card>
                    <CardHeader className="pb-2 px-3 sm:px-6">
                        <CardTitle className="text-base">Context</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 px-3 sm:px-6">
                        <Collapsible open={contextOpen} onOpenChange={setContextOpen}>
                            <CollapsibleTrigger className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors">
                                {contextOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                <span>Details</span>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2">
                                <div className="markdown-body text-sm">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {decision.context}
                                    </ReactMarkdown>
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    </CardContent>
                </Card>
            )}

            <DecisionForm
                decision={decision}
                issueNumber={issueNumber}
                token={token}
                onSubmitted={(destination) => {
                    setRoutedTo(destination);
                    setSubmitted(true);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
            />
        </div>
    );
}
