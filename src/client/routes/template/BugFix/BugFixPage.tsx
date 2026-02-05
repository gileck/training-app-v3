/**
 * Bug Fix Page Component
 *
 * Displays the bug investigation results and allows admin to select
 * a fix approach or provide a custom solution.
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { FixSelection, ParsedFixOption } from '@/apis/template/bug-fix-select/types';
import { getInvestigation, submitFixSelection } from '@/apis/template/bug-fix-select/client';
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
import { AlertCircle, Loader2, Check, ChevronDown, ChevronUp, Bug } from 'lucide-react';

interface BugFixPageProps {
    issueNumber: number;
    token: string;
}

export function BugFixPage({ issueNumber, token }: BugFixPageProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state for fix selection
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state for custom solution
    const [customSolution, setCustomSolution] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state for custom destination
    const [customDestination, setCustomDestination] = useState<'implement' | 'tech-design'>('tech-design');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state for notes
    const [notes, setNotes] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state for form submission status
    const [submitted, setSubmitted] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state for collapsible
    const [analysisOpen, setAnalysisOpen] = useState(true);

    // Fetch investigation data
    const {
        data: investigationResponse,
        isLoading,
        error: fetchError,
    } = useQuery({
        queryKey: ['bug-investigation', issueNumber, token],
        queryFn: async () => {
            const response = await getInvestigation({ issueNumber, token });
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
            const selection: FixSelection = {
                selectedOptionId: selectedOption!,
                customSolution: selectedOption === 'custom' ? customSolution : undefined,
                customDestination: selectedOption === 'custom' ? customDestination : undefined,
                notes: notes || undefined,
            };

            const response = await submitFixSelection({
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

    const investigation = investigationResponse?.investigation;

    // Validation
    const isCustomSelected = selectedOption === 'custom';
    const customValid = !isCustomSelected || (customSolution.trim().length > 0);
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
    if (fetchError || investigationResponse?.error) {
        const errorMessage = fetchError?.message || investigationResponse?.error || 'Unknown error';
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

    // No investigation found
    if (!investigation) {
        return (
            <div className="p-3 sm:p-4 max-w-2xl mx-auto">
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Not Found</AlertTitle>
                    <AlertDescription>
                        No bug investigation found for issue #{issueNumber}.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    // Success state
    if (submitted) {
        const routedTo = submitMutation.data?.routedTo;
        const destinationLabel = routedTo === 'implement' ? 'Implementation' : 'Technical Design';

        return (
            <div className="p-3 sm:p-4 max-w-2xl mx-auto">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <Check className="h-12 w-12 text-primary" />
                            <div className="space-y-2">
                                <h2 className="text-xl font-semibold text-foreground">
                                    Fix Selection Submitted!
                                </h2>
                                <p className="text-muted-foreground">
                                    Bug #{issueNumber} has been routed to {destinationLabel}.
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    The fix will be processed in the next workflow run.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const confidenceEmoji = investigation.confidence === 'high' ? '🟢' : investigation.confidence === 'medium' ? '🟡' : '🔴';
    const confidenceLabel = investigation.confidence.charAt(0).toUpperCase() + investigation.confidence.slice(1);

    return (
        <div className="p-3 sm:p-4 pb-24 max-w-2xl mx-auto space-y-4">
            {/* Header */}
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    <Bug className="h-5 w-5 text-destructive shrink-0" />
                    <h1 className="text-lg sm:text-xl font-bold text-foreground">
                        Bug Fix Selection
                    </h1>
                </div>
                <p className="text-sm text-muted-foreground">
                    Issue #{issueNumber}: {investigation.issueTitle}
                </p>
            </div>

            {/* Investigation Summary */}
            <Card>
                <CardHeader className="pb-2 px-3 sm:px-6">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <CardTitle className="text-base">Investigation Results</CardTitle>
                        <span className={`text-sm font-normal ${investigation.rootCauseFound ? 'text-primary' : 'text-destructive'}`}>
                            {investigation.rootCauseFound ? '(Root cause found)' : '(Root cause uncertain)'}
                        </span>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3 px-3 sm:px-6">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <span>
                            <strong>Confidence:</strong> {confidenceEmoji} {confidenceLabel}
                        </span>
                        <span>
                            <strong>Options:</strong> {investigation.fixOptions.length}
                        </span>
                    </div>

                    {/* Root cause analysis (collapsible, open by default) */}
                    <Collapsible open={analysisOpen} onOpenChange={setAnalysisOpen}>
                        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors">
                            {analysisOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            <span>Root Cause Analysis</span>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                            <div className="markdown-body text-sm">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {investigation.rootCauseAnalysis}
                                </ReactMarkdown>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                </CardContent>
            </Card>

            {/* Fix Options */}
            <Card>
                <CardHeader className="pb-2 px-3 sm:px-6">
                    <CardTitle className="text-base">Choose Fix Approach</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 px-3 sm:px-6">
                    <RadioGroup value={selectedOption || ''} onValueChange={setSelectedOption}>
                        {investigation.fixOptions.map((option) => (
                            <FixOptionCard
                                key={option.id}
                                option={option}
                                isSelected={selectedOption === option.id}
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
                                id="fix-custom"
                                className="mt-0.5 shrink-0"
                            />
                            <Label htmlFor="fix-custom" className="flex-1 cursor-pointer">
                                <span className="font-medium">Custom Solution</span>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Provide your own fix approach
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
                                        placeholder="Describe the fix approach..."
                                        value={customSolution}
                                        onChange={(e) => setCustomSolution(e.target.value)}
                                        className="min-h-[100px]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Route to</Label>
                                    <RadioGroup
                                        value={customDestination}
                                        onValueChange={(v) => setCustomDestination(v as 'implement' | 'tech-design')}
                                        className="flex gap-4"
                                    >
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="tech-design" id="dest-tech" />
                                            <Label htmlFor="dest-tech" className="cursor-pointer">
                                                Technical Design
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="implement" id="dest-impl" />
                                            <Label htmlFor="dest-impl" className="cursor-pointer">
                                                Implementation
                                            </Label>
                                        </div>
                                    </RadioGroup>
                                </div>
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
                            <AlertDescription>
                                {submitMutation.error.message}
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
                            Please select a fix option to continue
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

// ============================================================
// FIX OPTION CARD COMPONENT
// ============================================================

interface FixOptionCardProps {
    option: ParsedFixOption;
    isSelected: boolean;
}

function FixOptionCard({ option, isSelected }: FixOptionCardProps) {
    const destinationLabel = option.destination === 'implement' ? 'Implementation' : 'Tech Design';
    const complexityColors: Record<string, string> = {
        S: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        M: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        L: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
        XL: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };

    return (
        <div
            className={`p-3 rounded-md border transition-colors cursor-pointer ${
                isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50'
            }`}
            onClick={() => {
                const radio = document.getElementById(`fix-${option.id}`) as HTMLButtonElement | null;
                radio?.click();
            }}
        >
            {/* Title row with radio */}
            <div className="flex items-start gap-3">
                <RadioGroupItem
                    value={option.id}
                    id={`fix-${option.id}`}
                    className="mt-0.5 shrink-0"
                />
                <Label htmlFor={`fix-${option.id}`} className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{option.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${complexityColors[option.complexity]}`}>
                            {option.complexity}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            → {destinationLabel}
                        </span>
                        {option.isRecommended && (
                            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium">
                                Recommended
                            </span>
                        )}
                    </div>
                </Label>
            </div>

            {/* Description rendered as markdown (outside label to allow block elements) */}
            <div className="markdown-body text-sm mt-2 pl-7">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {option.description}
                </ReactMarkdown>
            </div>

            {/* Files and tradeoffs */}
            {option.filesAffected.length > 0 && (
                <div className="text-xs text-muted-foreground mt-2 pl-7">
                    <strong>Files:</strong>{' '}
                    {option.filesAffected.map((f, i) => (
                        <span key={f}>
                            <code className="bg-muted px-1 py-0.5 rounded text-[11px]">{f}</code>
                            {i < option.filesAffected.length - 1 && ', '}
                        </span>
                    ))}
                </div>
            )}
            {option.tradeoffs && (
                <p className="text-xs text-muted-foreground italic mt-1 pl-7">
                    <strong>Trade-offs:</strong> {option.tradeoffs}
                </p>
            )}
        </div>
    );
}
