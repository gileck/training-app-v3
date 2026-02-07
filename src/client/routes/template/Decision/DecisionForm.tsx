import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/template/ui/card';
import { Label } from '@/client/components/template/ui/label';
import { RadioGroup, RadioGroupItem } from '@/client/components/template/ui/radio-group';
import { Textarea } from '@/client/components/template/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/client/components/template/ui/alert';
import { Button } from '@/client/components/template/ui/button';
import { AlertCircle, Loader2, Check, Copy, CheckCheck } from 'lucide-react';
import { OptionCard } from './OptionCard';
import type { DecisionSelection, ParsedDecision } from '@/apis/template/agent-decision/types';
import { submitDecision } from '@/apis/template/agent-decision/client';

interface DecisionFormProps {
    decision: ParsedDecision;
    issueNumber: number;
    token: string;
    onSubmitted: (routedTo?: string) => void;
}

export function DecisionForm({ decision, issueNumber, token, onSubmitted }: DecisionFormProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state for option selection
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state for custom solution
    const [customSolution, setCustomSolution] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state for custom destination
    const [customDestination, setCustomDestination] = useState<string>('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state for notes
    const [notes, setNotes] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state for copy feedback
    const [copied, setCopied] = useState(false);

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
        onSuccess: (data) => {
            onSubmitted(data?.routedTo);
        },
    });

    const hasCustomDestinations = decision.customDestinationOptions && decision.customDestinationOptions.length > 0;

    useEffect(() => {
        if (decision.customDestinationOptions && decision.customDestinationOptions.length > 0 && !customDestination) {
            setCustomDestination(decision.customDestinationOptions[0].value);
        }
    }, [decision, customDestination]);

    const isCustomSelected = selectedOption === 'custom';
    const customValid = !isCustomSelected || (customSolution.trim().length > 0 && (!hasCustomDestinations || customDestination));
    const canSubmit = selectedOption && customValid && !submitMutation.isPending;

    return (
        <>
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

            <div className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 bg-background border-t border-border">
                <div className="max-w-2xl mx-auto">
                    <Button
                        onClick={() => submitMutation.mutate()}
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
        </>
    );
}
