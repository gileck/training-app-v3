/**
 * Decision Page Component
 *
 * Generic decision page that displays agent-provided options
 * and allows admin to select one or provide a custom solution.
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { DecisionSelection } from '@/apis/template/agent-decision/types';
import { getDecision, submitDecision } from '@/apis/template/agent-decision/client';
import { Button } from '@/client/components/template/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/template/ui/card';
import { Label } from '@/client/components/template/ui/label';
import { RadioGroup, RadioGroupItem } from '@/client/components/template/ui/radio-group';
import { Textarea } from '@/client/components/template/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/client/components/template/ui/alert';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/client/components/template/ui/collapsible';
import { AlertCircle, Loader2, Check, ChevronDown, ChevronUp, GitBranch, Copy, CheckCheck } from 'lucide-react';
import { OptionCard } from './OptionCard';

interface DecisionPageProps {
    issueNumber: number;
    token: string;
}

export function DecisionPage({ issueNumber, token }: DecisionPageProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state for option selection
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state for custom solution
    const [customSolution, setCustomSolution] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state for custom destination
    const [customDestination, setCustomDestination] = useState<string>('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state for notes
    const [notes, setNotes] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state for form submission status
    const [submitted, setSubmitted] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state for collapsible
    const [contextOpen, setContextOpen] = useState(true);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state for copy feedback
    const [copied, setCopied] = useState(false);

    // Fetch decision data
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

    // Submit mutation
    const submitMutation = useMutation({
        mutationFn: async () => {
            const selection: DecisionSelection = {
                selectedOptionId: selectedOption!,
                customSolution: selectedOption === 'custom' ? customSolution : undefined,
                customDestination: selectedOption === 'custom' && customDestination ? customDestination : undefined,
                notes: notes || undefined,
            };

            const response = await submitDecision({
                issueNumber,
                token,
                selection,
            });

            if (response.data?.error) {
                throw new Error(response.data.error);
            }

            return response.data;
        },
        onSuccess: () => {
            setSubmitted(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },
    });

    const decision = decisionResponse?.decision;

    const hasCustomDestinations = decision?.customDestinationOptions && decision.customDestinationOptions.length > 0;

    // Set default custom destination when decision loads
    useEffect(() => {
        if (decision?.customDestinationOptions && decision.customDestinationOptions.length > 0 && !customDestination) {
            setCustomDestination(decision.customDestinationOptions[0].value);
        }
    }, [decision, customDestination]);

    // Validation
    const isCustomSelected = selectedOption === 'custom';
    const customValid = !isCustomSelected || (customSolution.trim().length > 0 && (!hasCustomDestinations || customDestination));
    const canSubmit = selectedOption && customValid && !submitMutation.isPending;

    const handleSubmit = () => {
        submitMutation.mutate();
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // Error state
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

    // No decision found
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

    // Success state
    if (submitted) {
        const routedTo = submitMutation.data?.routedTo;

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
            {/* Header */}
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

            {/* Decision Context */}
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

            {/* Options */}
            <Card>
                <CardHeader className="pb-2 px-3 sm:px-6">
                    <CardTitle className="text-base">Choose Option</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 px-3 sm:px-6">
                    <RadioGroup value={selectedOption || ''} onValueChange={setSelectedOption}>
                        {decision.options.map((option) => (
                            <OptionCard
                                key={option.id}
                                option={option}
                                isSelected={selectedOption === option.id}
                                metadataSchema={decision.metadataSchema}
                            />
                        ))}

                        {/* Custom solution option */}
                        <div
                            className={`flex items-start gap-3 p-3 rounded-md border transition-colors ${
                                selectedOption === 'custom'
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-muted-foreground/50'
                            }`}
                        >
                            <RadioGroupItem
                                value="custom"
                                id="decision-custom"
                                className="mt-0.5 shrink-0"
                            />
                            <Label htmlFor="decision-custom" className="flex-1 cursor-pointer">
                                <span className="font-medium">Custom Solution</span>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Provide your own approach
                                </p>
                            </Label>
                        </div>

                        {/* Custom solution form */}
                        {isCustomSelected && (
                            <div className="space-y-4 pl-3 sm:pl-6 mt-2">
                                <div className="space-y-2">
                                    <Label htmlFor="custom-solution">Describe your solution</Label>
                                    <Textarea
                                        id="custom-solution"
                                        placeholder="Describe your approach..."
                                        value={customSolution}
                                        onChange={(e) => setCustomSolution(e.target.value)}
                                        className="min-h-[100px]"
                                    />
                                </div>
                                {hasCustomDestinations && (
                                    <div className="space-y-2">
                                        <Label>Route to</Label>
                                        <RadioGroup
                                            value={customDestination}
                                            onValueChange={setCustomDestination}
                                            className="flex gap-4"
                                        >
                                            {decision.customDestinationOptions!.map((dest) => (
                                                <div key={dest.value} className="flex items-center space-x-2">
                                                    <RadioGroupItem value={dest.value} id={`dest-${dest.value}`} />
                                                    <Label htmlFor={`dest-${dest.value}`} className="cursor-pointer">
                                                        {dest.label}
                                                    </Label>
                                                </div>
                                            ))}
                                        </RadioGroup>
                                    </div>
                                )}
                            </div>
                        )}
                    </RadioGroup>

                    {/* Optional notes */}
                    {selectedOption && selectedOption !== 'custom' && (
                        <div className="space-y-2">
                            <Label htmlFor="notes">Additional notes (optional)</Label>
                            <Textarea
                                id="notes"
                                placeholder="Any additional context or instructions..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="min-h-[60px]"
                            />
                        </div>
                    )}

                    {/* Submit error */}
                    {submitMutation.error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Submission Failed</AlertTitle>
                            <AlertDescription className="space-y-2">
                                <p>{submitMutation.error.message}</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => {
                                        navigator.clipboard.writeText(submitMutation.error!.message);
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 2000);
                                    }}
                                >
                                    {copied
                                        ? <><CheckCheck className="h-3 w-3 mr-1" /> Copied</>
                                        : <><Copy className="h-3 w-3 mr-1" /> Copy Error</>
                                    }
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* Submit button (fixed at bottom) */}
            <div className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 bg-background border-t border-border">
                <div className="max-w-2xl mx-auto">
                    <Button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="w-full"
                        size="lg"
                    >
                        {submitMutation.isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            <>
                                <Check className="h-4 w-4 mr-1" />
                                Submit Selection
                            </>
                        )}
                    </Button>
                    {!selectedOption && (
                        <p className="text-xs text-muted-foreground text-center mt-2">
                            Please select an option to continue
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
