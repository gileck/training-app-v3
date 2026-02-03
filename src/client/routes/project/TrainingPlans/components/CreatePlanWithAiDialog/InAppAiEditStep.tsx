/**
 * In-app AI Edit Step Component
 *
 * Form for generating a training plan using in-app AI models.
 * Includes plan name, duration, model selection, and prompt input.
 */

import { Button } from '@/client/components/template/ui/button';
import { Input } from '@/client/components/template/ui/input';
import { Label } from '@/client/components/template/ui/label';
import { Textarea } from '@/client/components/template/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/client/components/template/ui/select';
import { ClipboardPaste, X, AlertCircle } from 'lucide-react';
import type { AIModelDefinition } from '@/common/ai/models';
import { MAX_TEXT_LENGTH, MAX_PLAN_NAME_LENGTH, type InAppAiEditStepProps } from './types';

export function InAppAiEditStep({
    planName,
    setPlanName,
    durationWeeks,
    setDurationWeeks,
    selectedModelId,
    setSelectedModelId,
    promptInput,
    setPromptInput,
    models,
    selectedModel,
    charCount,
    charCountColor,
    isGenerating,
    isOffline,
    error,
    onPaste,
    onClear,
}: InAppAiEditStepProps) {
    return (
        <div className="grid gap-4">
            {/* Plan Name */}
            <div className="grid gap-2">
                <Label htmlFor="ai-plan-name">Plan Name</Label>
                <Input
                    id="ai-plan-name"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value.slice(0, MAX_PLAN_NAME_LENGTH))}
                    placeholder="e.g., Push/Pull/Legs, Full Body 3x"
                    disabled={isGenerating}
                />
            </div>

            {/* Duration */}
            <div className="grid gap-2">
                <Label htmlFor="ai-plan-weeks">Duration (weeks)</Label>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setDurationWeeks((w) => Math.max(1, w - 1))}
                        disabled={durationWeeks <= 1 || isGenerating}
                    >
                        -
                    </Button>
                    <span className="w-12 text-center font-semibold text-lg">
                        {durationWeeks}
                    </span>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setDurationWeeks((w) => Math.min(52, w + 1))}
                        disabled={durationWeeks >= 52 || isGenerating}
                    >
                        +
                    </Button>
                </div>
            </div>

            {/* AI Model Selection */}
            <div className="grid gap-2">
                <Label htmlFor="ai-model">AI Model</Label>
                <Select
                    value={selectedModelId}
                    onValueChange={setSelectedModelId}
                    disabled={isGenerating}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                        {models.map((model: AIModelDefinition) => (
                            <SelectItem key={model.id} value={model.id}>
                                {model.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Text Input */}
            <div className="grid gap-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="ai-prompt">Describe Your Plan</Label>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onPaste}
                            disabled={isGenerating}
                            className="h-8 text-xs"
                        >
                            <ClipboardPaste className="h-3 w-3 mr-1" />
                            Paste
                        </Button>
                        {promptInput.text && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onClear}
                                disabled={isGenerating}
                                className="h-8 text-xs"
                            >
                                <X className="h-3 w-3 mr-1" />
                                Clear
                            </Button>
                        )}
                    </div>
                </div>
                <Textarea
                    id="ai-prompt"
                    value={promptInput.text}
                    onChange={(e) => setPromptInput({ text: e.target.value })}
                    placeholder={`Enter anything from generic to specific:

Generic: "Create a basic push/pull/legs workout plan for building muscle"

Specific:
"Day 1 - Push:
Bench Press — 3×8
Overhead Press — 3×10
Incline Dumbbell Press — 3×12

Day 2 - Pull:
Deadlifts — 3×5
Barbell Rows — 3×8
Pull-ups — 3×10"`}
                    className="min-h-[200px] font-mono text-sm"
                    disabled={isGenerating}
                />
                <div className="flex justify-between items-center">
                    <span className={`text-xs ${charCountColor}`}>
                        {charCount.toLocaleString()} / {MAX_TEXT_LENGTH.toLocaleString()} characters
                    </span>
                    {selectedModel && (
                        <span className="text-xs text-muted-foreground">
                            Using {selectedModel.name}
                        </span>
                    )}
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Offline Warning */}
            {isOffline && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 text-warning text-sm">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>You&apos;re offline. AI generation requires an internet connection.</span>
                </div>
            )}
        </div>
    );
}
