/**
 * Create Plan With AI Dialog
 * 
 * Two-step dialog: edit → preview
 * Allows user to enter free-form text and preview the AI-generated plan before committing.
 */

import { useState, useCallback } from 'react';
import { Button } from '@/client/components/ui/button';
import { Input } from '@/client/components/ui/input';
import { Label } from '@/client/components/ui/label';
import { Textarea } from '@/client/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/client/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/client/components/ui/select';
import {
    Sparkles,
    ArrowLeft,
    ClipboardPaste,
    X,
    Check,
    AlertCircle,
    RefreshCw,
    Loader2,
} from 'lucide-react';
import { getAllModels, type AIModelDefinition } from '@/common/ai/models';
import { useSettingsStore } from '@/client/features/settings';
import { useEffectiveOffline } from '@/client/features/settings';
import { useGeneratePlanFromText, useCreatePlanFromText } from '../hooks';
import type { DraftPlan } from '@/apis/training-plans/types';
import { toast } from '@/client/components/ui/toast';
import { AiPlanPreview } from './AiPlanPreview';
import type { ExerciseResolution } from './ExerciseResolver';

// Input validation limits (matching server)
const MAX_TEXT_LENGTH = 10000;
const MAX_PLAN_NAME_LENGTH = 100;

interface CreatePlanWithAiDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: (planId: string) => void;
    existingPlansCount: number; // Reserved for future use (e.g., first plan prompts)
}

type DialogStep = 'edit' | 'preview';

// Prompt input state (extensible for Phase 2)
interface PromptInput {
    text: string;
    // Phase 2 fields:
    // level?: 'beginner' | 'intermediate' | 'advanced';
    // daysPerWeek?: number;
    // goals?: string[];
    // equipment?: string[];
    // musclesFocus?: string[];
}

export function CreatePlanWithAiDialog({
    open,
    onOpenChange,
    onSuccess,
    existingPlansCount: _existingPlansCount,
}: CreatePlanWithAiDialogProps) {
    // Settings for default model
    const settings = useSettingsStore((state) => state.settings);
    const isOffline = useEffectiveOffline();
    const models = getAllModels();
    
    // Mutation hooks
    const generateMutation = useGeneratePlanFromText();
    const createMutation = useCreatePlanFromText();
    
    // Form state
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
    const [planName, setPlanName] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
    const [durationWeeks, setDurationWeeks] = useState(8);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
    const [selectedModelId, setSelectedModelId] = useState(settings.aiModel || models[0]?.id || '');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
    const [promptInput, setPromptInput] = useState<PromptInput>({ text: '' });
    
    // Dialog step state
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [step, setStep] = useState<DialogStep>('edit');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral preview data
    const [preview, setPreview] = useState<DraftPlan | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral cost display
    const [previewCost, setPreviewCost] = useState<number | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral error state
    const [error, setError] = useState<string | null>(null);
    
    // Derived loading states
    const isGenerating = generateMutation.isPending;
    const isCommitting = createMutation.isPending;
    
    // Reset dialog state
    const resetDialog = useCallback(() => {
        setPlanName('');
        setDurationWeeks(8);
        setSelectedModelId(settings.aiModel || models[0]?.id || '');
        setPromptInput({ text: '' });
        setStep('edit');
        setPreview(null);
        setPreviewCost(null);
        setError(null);
        generateMutation.reset();
        createMutation.reset();
    }, [settings.aiModel, models, generateMutation, createMutation]);
    
    // Handle dialog close
    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) {
            // Don't allow closing while committing
            if (isCommitting) return;
            resetDialog();
        }
        onOpenChange(newOpen);
    };
    
    // Handle paste from clipboard
    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                setPromptInput((prev) => ({ ...prev, text }));
            }
        } catch (err) {
            console.error('Failed to read clipboard:', err);
            toast.error('Could not access clipboard. Please paste manually.');
        }
    };
    
    // Handle clear text
    const handleClear = () => {
        setPromptInput({ text: '' });
    };
    
    // Handle generate preview
    const handleGeneratePreview = () => {
        if (!planName.trim()) {
            setError('Please enter a plan name');
            return;
        }
        if (!promptInput.text.trim()) {
            setError('Please enter a description of your training plan');
            return;
        }
        if (isOffline) {
            setError('AI generation requires an internet connection');
            return;
        }
        
        setError(null);
        
        generateMutation.mutate(
            {
                modelId: selectedModelId,
                planName: planName.trim(),
                durationWeeks,
                text: promptInput.text.trim(),
            },
            {
                onSuccess: (data) => {
                    if (data.preview) {
                        setPreview(data.preview);
                        setPreviewCost(data.cost?.totalCost ?? null);
                        setStep('preview');
                    }
                },
                onError: (err) => {
                    setError(err.message || 'Failed to generate preview. Please try again.');
                },
            }
        );
    };
    
    // Handle back to edit
    const handleBackToEdit = () => {
        setStep('edit');
        setError(null);
    };
    
    // Handle exercise resolution
    const handleExerciseResolved = useCallback((exerciseKey: string, resolution: ExerciseResolution) => {
        if (!preview) return;
        
        setPreview({
            ...preview,
            exercises: preview.exercises.map(ex => 
                ex.draftExerciseKey === exerciseKey
                    ? {
                        ...ex,
                        matchStatus: resolution.matchStatus,
                        matchedExerciseDefId: resolution.matchedExerciseDefId,
                        matchedExerciseName: resolution.matchedExerciseName,
                        suggestedMatches: undefined, // Clear suggestions after resolution
                    }
                    : ex
            ),
        });
    }, [preview]);
    
    // Handle commit plan
    const handleCommit = () => {
        if (!preview) return;
        
        setError(null);
        
        createMutation.mutate(
            {
                planName: preview.planName,
                durationWeeks: preview.durationWeeks,
                draft: preview,
            },
            {
                onSuccess: (data) => {
                    if (data.plan) {
                        toast.success(`Plan "${data.plan.name}" created successfully!`);
                        onSuccess(data.plan._id);
                        handleOpenChange(false);
                    }
                },
                onError: (err) => {
                    setError(err.message || 'Failed to create plan. Please try again.');
                },
            }
        );
    };
    
    // Character count
    const charCount = promptInput.text.length;
    const charCountColor = charCount > MAX_TEXT_LENGTH ? 'text-destructive' : 'text-muted-foreground';
    
    // Validation
    const canGenerate = planName.trim().length > 0 && 
                        promptInput.text.trim().length >= 3 && 
                        promptInput.text.length <= MAX_TEXT_LENGTH &&
                        !isOffline;
    
    // Check if all exercises are resolved (no 'unresolved' status)
    const hasUnresolvedExercises = preview?.exercises.some(e => e.matchStatus === 'unresolved') ?? false;
    const canCommit = !hasUnresolvedExercises;
    
    // Get selected model info
    const selectedModel = models.find((m) => m.id === selectedModelId);
    
    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Create Plan with AI
                    </DialogTitle>
                    {step === 'edit' && (
                        <DialogDescription>
                            Describe your training plan and let AI structure it for you
                        </DialogDescription>
                    )}
                    {step === 'preview' && (
                        <DialogDescription>
                            Review the generated plan before saving
                        </DialogDescription>
                    )}
                </DialogHeader>
                
                {/* Edit Step */}
                {step === 'edit' && (
                    <EditStep
                        planName={planName}
                        setPlanName={setPlanName}
                        durationWeeks={durationWeeks}
                        setDurationWeeks={setDurationWeeks}
                        selectedModelId={selectedModelId}
                        setSelectedModelId={setSelectedModelId}
                        promptInput={promptInput}
                        setPromptInput={setPromptInput}
                        models={models}
                        selectedModel={selectedModel}
                        charCount={charCount}
                        charCountColor={charCountColor}
                        isGenerating={isGenerating}
                        isOffline={isOffline}
                        error={error}
                        onPaste={handlePaste}
                        onClear={handleClear}
                    />
                )}
                
                {/* Preview Step */}
                {step === 'preview' && preview && (
                    <>
                        <AiPlanPreview 
                            preview={preview} 
                            previewCost={previewCost}
                            onExerciseResolved={handleExerciseResolved}
                        />
                        
                        {/* Error Display */}
                        {error && (
                            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}
                    </>
                )}
                
                {/* Loading Overlay */}
                {isGenerating && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 rounded-2xl">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <div className="text-center">
                            <p className="font-medium">Generating preview...</p>
                            <p className="text-sm text-muted-foreground">
                                This can take up to ~40s for big plans
                            </p>
                        </div>
                    </div>
                )}
                
                <DialogFooter className="gap-2">
                    {step === 'edit' && (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => handleOpenChange(false)}
                                className="rounded-lg"
                                disabled={isGenerating}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleGeneratePreview}
                                disabled={!canGenerate || isGenerating}
                                className="rounded-lg"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-4 w-4 mr-2" />
                                        Generate Preview
                                    </>
                                )}
                            </Button>
                        </>
                    )}
                    
                    {step === 'preview' && (
                        <>
                            <Button
                                variant="outline"
                                onClick={handleBackToEdit}
                                className="rounded-lg"
                                disabled={isCommitting}
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back to Edit
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleGeneratePreview}
                                className="rounded-lg"
                                disabled={isCommitting || isGenerating}
                            >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Regenerate
                            </Button>
                            <Button
                                onClick={handleCommit}
                                disabled={isCommitting || !canCommit}
                                className="rounded-lg"
                                title={!canCommit ? 'Resolve all exercises before creating' : undefined}
                            >
                                {isCommitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Check className="h-4 w-4 mr-2" />
                                        Create Plan
                                    </>
                                )}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ============================================================================
// Edit Step Component
// ============================================================================

interface EditStepProps {
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

function EditStep({
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
}: EditStepProps) {
    return (
        <div className="grid gap-4 py-4">
            {/* Plan Name */}
            <div className="grid gap-2">
                <Label htmlFor="ai-plan-name">Plan Name</Label>
                <Input
                    id="ai-plan-name"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value.slice(0, MAX_PLAN_NAME_LENGTH))}
                    placeholder="e.g., Push/Pull/Legs, Full Body 3x"
                    className="rounded-lg"
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
                        className="h-10 w-10 rounded-lg"
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
                        className="h-10 w-10 rounded-lg"
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
                    <SelectTrigger className="rounded-lg">
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
                    className="rounded-lg min-h-[200px] font-mono text-sm"
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
