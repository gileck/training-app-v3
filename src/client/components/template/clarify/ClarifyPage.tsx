/**
 * Clarify Page Component
 *
 * Wizard-style flow for answering agent clarification questions.
 * Shows one question at a time with progress indicator and preview step.
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import type { QuestionAnswer } from '@/apis/template/clarification/types';
import { getClarification, submitAnswer } from '@/apis/template/clarification/client';
import { QuestionCard } from './QuestionCard';
import { SuccessState } from './SuccessState';
import { Button } from '@/client/components/template/ui/button';
import { AlertCircle, Loader2, ChevronLeft, ChevronRight, Check, Pencil } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/client/components/template/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/template/ui/card';

interface ClarifyPageProps {
    issueNumber: number;
    token: string;
}

export function ClarifyPage({ issueNumber, token }: ClarifyPageProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state for answers, not persisted or shared
    const [answers, setAnswers] = useState<Map<number, QuestionAnswer>>(new Map());
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state for form submission status
    const [submitted, setSubmitted] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral wizard step state
    const [currentStep, setCurrentStep] = useState(0);

    // Fetch clarification data
    const {
        data: clarificationResponse,
        isLoading,
        error: fetchError,
    } = useQuery({
        queryKey: ['clarification', issueNumber, token],
        queryFn: async () => {
            const response = await getClarification({ issueNumber, token });
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        staleTime: Infinity, // Intentional: clarification data is immutable once created
        retry: false,
    });

    // Submit mutation
    const submitMutation = useMutation({
        mutationFn: async () => {
            const answerArray = Array.from(answers.values());
            const response = await submitAnswer({
                issueNumber,
                token,
                answers: answerArray,
            });
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        onSuccess: () => {
            setSubmitted(true);
            // Scroll to top to show success state
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },
    });

    const handleAnswerChange = (answer: QuestionAnswer) => {
        setAnswers((prev) => {
            const next = new Map(prev);
            next.set(answer.questionIndex, answer);
            return next;
        });
    };

    const handleSubmit = () => {
        submitMutation.mutate();
    };

    const clarification = clarificationResponse?.clarification;
    const totalQuestions = clarification?.questions.length ?? 0;
    const isPreviewStep = currentStep === totalQuestions;
    const totalSteps = totalQuestions + 1; // questions + preview

    // Check if current question is answered
    const currentAnswered = answers.has(currentStep);
    const currentAnswer = answers.get(currentStep);
    const currentOtherValid = currentAnswer?.selectedOption !== 'Other' ||
        (currentAnswer?.customText?.trim() ?? '').length > 0;
    const canProceed = currentAnswered && currentOtherValid;

    // Check if all questions are answered (for preview step)
    const allAnswered = clarification?.questions.every(
        (_, index) => answers.has(index)
    ) ?? false;
    const otherAnswersValid = Array.from(answers.values()).every(
        (answer) => answer.selectedOption !== 'Other' || (answer.customText?.trim() ?? '').length > 0
    );
    const canSubmit = allAnswered && otherAnswersValid && !submitMutation.isPending;

    const goNext = () => {
        if (currentStep < totalQuestions) {
            setCurrentStep(currentStep + 1);
        }
    };

    const goBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const goToQuestion = (index: number) => {
        setCurrentStep(index);
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
    if (fetchError || clarificationResponse?.error) {
        const errorMessage = fetchError?.message || clarificationResponse?.error || 'Unknown error';
        return (
            <div className="p-4 max-w-2xl mx-auto">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            </div>
        );
    }

    // No clarification found
    if (!clarification) {
        return (
            <div className="p-4 max-w-2xl mx-auto">
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Not Found</AlertTitle>
                    <AlertDescription>
                        No clarification request found for issue #{issueNumber}.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    // Success state
    if (submitted) {
        return (
            <div className="p-4 max-w-2xl mx-auto">
                <SuccessState issueNumber={issueNumber} />
            </div>
        );
    }

    // No parsed questions - show raw content
    if (clarification.questions.length === 0) {
        return (
            <div className="p-4 max-w-2xl mx-auto space-y-4">
                <h1 className="text-xl font-bold">
                    Issue #{issueNumber}: {clarification.issueTitle}
                </h1>
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Unable to Parse Questions</AlertTitle>
                    <AlertDescription>
                        The clarification request could not be parsed into structured questions.
                        Please respond directly on GitHub.
                    </AlertDescription>
                </Alert>
                <div className="bg-muted p-4 rounded-md">
                    <pre className="whitespace-pre-wrap text-sm">
                        {clarification.rawContent}
                    </pre>
                </div>
            </div>
        );
    }

    // Main wizard form
    return (
        <div className="p-4 pb-24 max-w-2xl mx-auto space-y-4">
            {/* Header */}
            <div className="space-y-1">
                <h1 className="text-xl font-bold text-foreground">
                    Issue #{issueNumber}
                </h1>
                <p className="text-muted-foreground">
                    {clarification.issueTitle}
                </p>
            </div>

            {/* Progress indicator */}
            <div className="flex items-center justify-center gap-2">
                {Array.from({ length: totalSteps }).map((_, index) => (
                    <button
                        key={index}
                        onClick={() => index < totalQuestions ? goToQuestion(index) : undefined}
                        disabled={index === totalQuestions && !allAnswered}
                        className={`h-2 rounded-full transition-all ${
                            index === currentStep
                                ? 'w-8 bg-primary'
                                : index < currentStep || answers.has(index)
                                ? 'w-2 bg-primary/60 hover:bg-primary/80 cursor-pointer'
                                : 'w-2 bg-muted'
                        } ${index === totalQuestions ? 'cursor-default' : ''}`}
                        aria-label={index < totalQuestions ? `Question ${index + 1}` : 'Preview'}
                    />
                ))}
            </div>
            <p className="text-center text-sm text-muted-foreground">
                {isPreviewStep ? 'Review & Submit' : `Question ${currentStep + 1} of ${totalQuestions}`}
            </p>

            {/* Current question or preview */}
            {isPreviewStep ? (
                // Preview step
                <div className="space-y-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base text-foreground">Review Your Answers</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {clarification.questions.map((question, index) => {
                                const answer = answers.get(index);
                                const displayAnswer = answer?.selectedOption === 'Other'
                                    ? answer.customText
                                    : answer?.selectedOption;
                                return (
                                    <div
                                        key={index}
                                        className="flex items-start justify-between gap-3 p-3 rounded-md bg-muted/50"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-foreground">
                                                {question.question}
                                            </p>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                {displayAnswer || 'Not answered'}
                                            </p>
                                            {answer?.additionalNotes && (
                                                <p className="text-xs text-muted-foreground mt-1 italic">
                                                    Note: {answer.additionalNotes}
                                                </p>
                                            )}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => goToQuestion(index)}
                                            className="shrink-0"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>

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
                </div>
            ) : (
                // Question step
                <QuestionCard
                    question={clarification.questions[currentStep]}
                    questionIndex={currentStep}
                    answer={answers.get(currentStep)}
                    onAnswerChange={handleAnswerChange}
                />
            )}

            {/* Navigation buttons (fixed at bottom on mobile) */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
                <div className="max-w-2xl mx-auto flex gap-3">
                    {/* Back button */}
                    {currentStep > 0 && (
                        <Button
                            variant="outline"
                            onClick={goBack}
                            className="flex-1"
                            size="lg"
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Back
                        </Button>
                    )}

                    {/* Next / Submit button */}
                    {isPreviewStep ? (
                        <Button
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            className="flex-1"
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
                                    Submit Answers
                                </>
                            )}
                        </Button>
                    ) : (
                        <Button
                            onClick={goNext}
                            disabled={!canProceed}
                            className="flex-1"
                            size="lg"
                        >
                            {currentStep === totalQuestions - 1 ? 'Review' : 'Next'}
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    )}
                </div>
                {!isPreviewStep && !canProceed && (
                    <p className="text-xs text-muted-foreground text-center mt-2">
                        Please select an answer to continue
                    </p>
                )}
            </div>
        </div>
    );
}
