/**
 * Create Plan With AI Dialog
 * 
 * Two-mode dialog with tabs:
 * 1. In-app AI: Describe plan → AI generates → preview → commit
 * 2. ChatGPT: Open ChatGPT with prompt → paste JSON → preview → commit
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/tabs';
import {
    Sparkles,
    ArrowLeft,
    ClipboardPaste,
    X,
    Check,
    AlertCircle,
    RefreshCw,
    Loader2,
    ExternalLink,
    MessageSquare,
} from 'lucide-react';
import { getAllModels, type AIModelDefinition } from '@/common/ai/models';
import { useSettingsStore } from '@/client/features/settings';
import { useEffectiveOffline } from '@/client/features/settings';
import { useGeneratePlanFromText, useCreatePlanFromText, useMatchImportedPlan, useExerciseLibrary } from '../hooks';
import type { DraftPlan, PlanExportData } from '@/apis/training-plans/types';
import { toast } from '@/client/components/ui/toast';
import { PlanPreview } from './PlanPreview';
import type { ExerciseResolution } from './ExerciseResolver';
import { 
    validatePlanExportJson, 
    buildChatGptPlanPrompt,
    buildChatGptUrl,
} from '../utils';

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
type AiMode = 'inapp' | 'chatgpt';

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
    const matchMutation = useMatchImportedPlan();
    
    // Exercise library for search functionality in resolver
    const { data: exerciseLibraryData } = useExerciseLibrary();
    const exerciseLibrary = exerciseLibraryData?.exercises || [];
    
    // Tab state
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral tab state
    const [aiMode, setAiMode] = useState<AiMode>('inapp');
    
    // In-app AI form state
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
    const [planName, setPlanName] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
    const [durationWeeks, setDurationWeeks] = useState(8);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
    const [selectedModelId, setSelectedModelId] = useState(settings.aiModel || models[0]?.id || '');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
    const [promptInput, setPromptInput] = useState<PromptInput>({ text: '' });
    
    // ChatGPT mode state
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
    const [chatGptJsonInput, setChatGptJsonInput] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral validation state
    const [chatGptValidationError, setChatGptValidationError] = useState<string | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral parsed data
    const [chatGptParsedData, setChatGptParsedData] = useState<PlanExportData | null>(null);
    
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
    const isMatching = matchMutation.isPending;
    const isCommitting = createMutation.isPending;
    
    // Reset dialog state
    const resetDialog = useCallback(() => {
        // Reset tab
        setAiMode('inapp');
        // Reset in-app AI state
        setPlanName('');
        setDurationWeeks(8);
        setSelectedModelId(settings.aiModel || models[0]?.id || '');
        setPromptInput({ text: '' });
        // Reset ChatGPT state
        setChatGptJsonInput('');
        setChatGptValidationError(null);
        setChatGptParsedData(null);
        // Reset common state
        setStep('edit');
        setPreview(null);
        setPreviewCost(null);
        setError(null);
        generateMutation.reset();
        createMutation.reset();
        matchMutation.reset();
    }, [settings.aiModel, models, generateMutation, createMutation, matchMutation]);
    
    // Handle dialog close
    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) {
            // Don't allow closing while committing
            if (isCommitting) return;
            resetDialog();
        }
        onOpenChange(newOpen);
    };
    
    // ============================================================================
    // In-app AI handlers
    // ============================================================================
    
    // Handle paste from clipboard (in-app AI)
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
    
    // Handle clear text (in-app AI)
    const handleClear = () => {
        setPromptInput({ text: '' });
    };
    
    // Handle generate preview (in-app AI)
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
    
    // Handle back to edit (shared by both flows)
    const handleBackToEdit = () => {
        setStep('edit');
        setPreview(null);
        setError(null);
    };
    
    // Handle exercise resolution (shared by both in-app AI and ChatGPT flows)
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
    
    // Handle commit plan (in-app AI)
    const handleCommit = () => {
        if (!preview) return;
        
        setError(null);
        
        createMutation.mutate(
            {
                planName: preview.planName,
                durationWeeks: preview.durationWeeks,
                draft: preview,
                creationSource: 'ai',
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
    
    // ============================================================================
    // ChatGPT mode handlers
    // ============================================================================
    
    // Open ChatGPT with prefilled prompt
    const handleOpenChatGpt = async () => {
        const prompt = buildChatGptPlanPrompt();
        const url = buildChatGptUrl(prompt);
        
        // Try to copy prompt to clipboard as fallback
        try {
            await navigator.clipboard.writeText(prompt);
            toast.success('Prompt copied! Opening ChatGPT...');
        } catch {
            // Clipboard access denied - still open the URL
            toast.info('Opening ChatGPT...');
        }
        
        // Open ChatGPT in new tab
        window.open(url, '_blank', 'noopener,noreferrer');
    };
    
    // Validate ChatGPT JSON input
    const validateChatGptInput = useCallback((input: string) => {
        if (!input.trim()) {
            setChatGptValidationError(null);
            setChatGptParsedData(null);
            return;
        }

        const result = validatePlanExportJson(input);
        if (result.valid && result.data) {
            setChatGptValidationError(null);
            setChatGptParsedData(result.data);
        } else {
            setChatGptValidationError(result.error || 'Invalid JSON');
            setChatGptParsedData(null);
        }
    }, []);
    
    // Handle ChatGPT JSON input change
    const handleChatGptJsonChange = (value: string) => {
        setChatGptJsonInput(value);
        validateChatGptInput(value);
    };
    
    // Handle paste from clipboard (ChatGPT)
    const handleChatGptPaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                setChatGptJsonInput(text);
                validateChatGptInput(text);
            }
        } catch (err) {
            console.error('Failed to read clipboard:', err);
            toast.error('Clipboard access denied. Please paste manually (Ctrl+V / Cmd+V).');
        }
    };
    
    // Handle clear (ChatGPT)
    const handleChatGptClear = () => {
        setChatGptJsonInput('');
        setChatGptValidationError(null);
        setChatGptParsedData(null);
    };
    
    // Handle continue to preview (ChatGPT) - calls server to match exercises (same as in-app AI)
    const handleChatGptContinue = () => {
        if (!chatGptParsedData) {
            setError('No valid JSON data. Please paste the plan JSON first.');
            return;
        }
        
        setError(null);
        
        // Call server to match exercises against library (just like in-app AI does)
        matchMutation.mutate(
            { importData: chatGptParsedData },
            {
                onSuccess: (data) => {
                    if (data.preview) {
                        setPreview(data.preview);
                        setStep('preview');
                    } else {
                        setError(data.error || 'Failed to process plan. No preview returned.');
                    }
                },
                onError: (err) => {
                    setError(err.message || 'Failed to process plan. Please try again.');
                },
            }
        );
    };
    
    // ============================================================================
    // Derived state
    // ============================================================================
    
    // Character count (in-app AI)
    const charCount = promptInput.text.length;
    const charCountColor = charCount > MAX_TEXT_LENGTH ? 'text-destructive' : 'text-muted-foreground';
    
    // Validation (in-app AI)
    const canGenerate = planName.trim().length > 0 && 
                        promptInput.text.trim().length >= 3 && 
                        promptInput.text.length <= MAX_TEXT_LENGTH &&
                        !isOffline;
    
    // Check if all exercises are resolved (no 'unresolved' status)
    const hasUnresolvedExercises = preview?.exercises.some(e => e.matchStatus === 'unresolved') ?? false;
    const canCommit = !hasUnresolvedExercises;
    
    // Get selected model info
    const selectedModel = models.find((m) => m.id === selectedModelId);
    
    // ChatGPT validation state
    const isChatGptJsonValid = chatGptParsedData !== null;
    
    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Create Plan with AI
                    </DialogTitle>
                    {step === 'edit' && (
                        <DialogDescription>
                            {aiMode === 'inapp' 
                                ? 'Describe your training plan and let AI structure it for you'
                                : 'Create your plan with ChatGPT and paste the JSON here'}
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
                    <Tabs value={aiMode} onValueChange={(v) => setAiMode(v as AiMode)} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="inapp" className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4" />
                                In-app AI
                            </TabsTrigger>
                            <TabsTrigger value="chatgpt" className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" />
                                ChatGPT
                            </TabsTrigger>
                        </TabsList>
                        
                        {/* In-app AI Tab */}
                        <TabsContent value="inapp" className="mt-4">
                            <InAppAiEditStep
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
                        </TabsContent>
                        
                        {/* ChatGPT Tab */}
                        <TabsContent value="chatgpt" className="mt-4">
                            <ChatGptEditStep
                                jsonInput={chatGptJsonInput}
                                onJsonChange={handleChatGptJsonChange}
                                validationError={chatGptValidationError}
                                isValidJson={isChatGptJsonValid}
                                parsedData={chatGptParsedData}
                                onOpenChatGpt={handleOpenChatGpt}
                                onPaste={handleChatGptPaste}
                                onClear={handleChatGptClear}
                                error={error}
                            />
                        </TabsContent>
                    </Tabs>
                )}
                
                {/* Preview Step - shared by both in-app AI and ChatGPT */}
                {step === 'preview' && preview && (
                    <>
                        <PlanPreview 
                            preview={preview} 
                            previewCost={aiMode === 'inapp' ? previewCost : null}
                            showMatchStatus={true}
                            onExerciseResolved={handleExerciseResolved}
                            exerciseLibrary={exerciseLibrary}
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
                {(isGenerating || isMatching) && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <div className="text-center">
                            <p className="font-medium">
                                {isGenerating ? 'Generating preview...' : 'Matching exercises...'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {isGenerating 
                                    ? 'This can take up to ~40s for big plans' 
                                    : 'Finding matches in your exercise library'}
                            </p>
                        </div>
                    </div>
                )}
                
                {/* Footer */}
                <DialogFooter className="gap-2">
                    {/* Edit Step - In-app AI */}
                    {step === 'edit' && aiMode === 'inapp' && (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => handleOpenChange(false)}
                                disabled={isGenerating}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleGeneratePreview}
                                disabled={!canGenerate || isGenerating}
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
                    
                    {/* Edit Step - ChatGPT */}
                    {step === 'edit' && aiMode === 'chatgpt' && (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => handleOpenChange(false)}
                                disabled={isMatching}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleChatGptContinue}
                                disabled={!isChatGptJsonValid || isMatching}
                            >
                                {isMatching ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Matching...
                                    </>
                                ) : (
                                    'Continue to Preview'
                                )}
                            </Button>
                        </>
                    )}
                    
                    {/* Preview Step - shared by both in-app AI and ChatGPT */}
                    {step === 'preview' && (
                        <>
                            <Button
                                variant="outline"
                                onClick={handleBackToEdit}
                                disabled={isCommitting}
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back
                            </Button>
                            {/* Regenerate only available for in-app AI */}
                            {aiMode === 'inapp' && (
                                <Button
                                    variant="outline"
                                    onClick={handleGeneratePreview}
                                    disabled={isCommitting || isGenerating}
                                >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Regenerate
                                </Button>
                            )}
                            <Button
                                onClick={handleCommit}
                                disabled={isCommitting || !canCommit}
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
// In-app AI Edit Step Component
// ============================================================================

interface InAppAiEditStepProps {
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

function InAppAiEditStep({
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

// ============================================================================
// ChatGPT Edit Step Component
// ============================================================================

interface ChatGptEditStepProps {
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

function ChatGptEditStep({
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
