/**
 * Shared types for CreatePlanWithAiDialog components
 */

import type { AIModelDefinition } from '@/common/ai/models';
import type { PlanExportData } from '@/apis/project/training-plans/types';

// Input validation limits (matching server)
export const MAX_TEXT_LENGTH = 10000;
export const MAX_PLAN_NAME_LENGTH = 100;

// Prompt input state (extensible for Phase 2)
export interface PromptInput {
    text: string;
    // Phase 2 fields:
    // level?: 'beginner' | 'intermediate' | 'advanced';
    // daysPerWeek?: number;
    // goals?: string[];
    // equipment?: string[];
    // musclesFocus?: string[];
}

// In-app AI Edit Step Props
export interface InAppAiEditStepProps {
    planName: string;
    setPlanName: (value: string) => void;
    durationWeeks: number;
    setDurationWeeks: (value: number | ((prev: number) => number)) => void;
    selectedModelId: string;
    setSelectedModelId: (value: string) => void;
    promptInput: PromptInput;
    setPromptInput: (value: PromptInput | ((prev: PromptInput) => PromptInput)) => void;
    models: AIModelDefinition[];
    selectedModel: AIModelDefinition | undefined;
    charCount: number;
    charCountColor: string;
    isGenerating: boolean;
    isOffline: boolean;
    error: string | null;
    onPaste: () => void;
    onClear: () => void;
}

// ChatGPT Edit Step Props
export interface ChatGptEditStepProps {
    jsonInput: string;
    onJsonChange: (value: string) => void;
    validationError: string | null;
    isValidJson: boolean;
    parsedData: PlanExportData | null;
    onOpenChatGpt: () => void;
    onPaste: () => void;
    onClear: () => void;
    error: string | null;
}
