/**
 * ChatGPT Edit Step Component
 *
 * Two-step workflow:
 * 1. Open ChatGPT with pre-filled prompt
 * 2. Paste the generated JSON back into the app
 */

import { Button } from '@/client/components/template/ui/button';
import { Textarea } from '@/client/components/template/ui/textarea';
import {
    ExternalLink,
    ClipboardPaste,
    X,
    Check,
    AlertCircle,
} from 'lucide-react';
import type { ChatGptEditStepProps } from './types';

export function ChatGptEditStep({
    jsonInput,
    onJsonChange,
    validationError,
    isValidJson,
    parsedData,
    onOpenChatGpt,
    onPaste,
    onClear,
    error,
}: ChatGptEditStepProps) {
    return (
        <div className="grid gap-4">
            {/* Step 1: Open ChatGPT */}
            <div className="p-4 rounded-lg border border-border bg-muted/30">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                        1
                    </div>
                    <div className="flex-1">
                        <h4 className="font-medium mb-1">Create your plan in ChatGPT</h4>
                        <p className="text-sm text-muted-foreground mb-3">
                            Click below to open ChatGPT with a pre-filled prompt. Answer a few questions to design your perfect training plan.
                        </p>
                        <Button onClick={onOpenChatGpt} className="w-full sm:w-auto">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open in ChatGPT
                        </Button>
                    </div>
                </div>
            </div>

            {/* Step 2: Paste JSON */}
            <div className="p-4 rounded-lg border border-border bg-muted/30">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                        2
                    </div>
                    <div className="flex-1">
                        <h4 className="font-medium mb-1">Paste the JSON plan</h4>
                        <p className="text-sm text-muted-foreground mb-3">
                            Once ChatGPT generates your plan, copy the JSON and paste it below.
                        </p>

                        {/* Action Buttons */}
                        <div className="flex gap-2 mb-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onPaste}
                            >
                                <ClipboardPaste className="h-4 w-4 mr-2" />
                                Paste from Clipboard
                            </Button>
                            {jsonInput && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onClear}
                                >
                                    <X className="h-4 w-4 mr-2" />
                                    Clear
                                </Button>
                            )}
                        </div>

                        {/* JSON Textarea */}
                        <Textarea
                            value={jsonInput}
                            onChange={(e) => onJsonChange(e.target.value)}
                            placeholder={`Paste the JSON from ChatGPT here...

Example format:
{
  "version": "1.0",
  "planName": "My Plan",
  "durationWeeks": 8,
  "workouts": [...]
}`}
                            className="min-h-[150px] font-mono text-sm"
                        />

                        {/* Validation Status */}
                        {jsonInput && (
                            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm mt-3 ${
                                isValidJson
                                    ? 'bg-success/10 text-success'
                                    : 'bg-destructive/10 text-destructive'
                            }`}>
                                {isValidJson ? (
                                    <>
                                        <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                        <span>Valid JSON - {parsedData?.planName} ({parsedData?.workouts.length} workouts)</span>
                                    </>
                                ) : (
                                    <>
                                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                        <span>{validationError}</span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Error Display (from API call) */}
            {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
