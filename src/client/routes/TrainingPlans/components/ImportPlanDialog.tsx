/**
 * Import Plan Dialog
 * 
 * Two-step dialog: JSON input → preview
 * Allows user to paste or upload JSON and preview the imported plan before committing.
 */

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/client/components/ui/button';
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
    Upload,
    ArrowLeft,
    ClipboardPaste,
    X,
    Check,
    AlertCircle,
    Loader2,
    FileJson,
} from 'lucide-react';
import { useMatchImportedPlan, useCreatePlanFromText } from '../hooks';
import type { DraftPlan, PlanExportData } from '@/apis/training-plans/types';
import { toast } from '@/client/components/ui/toast';
import { AiPlanPreview } from './AiPlanPreview';
import type { ExerciseResolution } from './ExerciseResolver';

// Validation limits (matching server)
const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const SUPPORTED_VERSION = '1.0';

interface ImportPlanDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: (planId: string) => void;
}

type DialogStep = 'input' | 'preview';

interface ValidationResult {
    valid: boolean;
    error?: string;
    data?: PlanExportData;
}

/**
 * Validate JSON structure client-side
 */
function validateImportJson(jsonString: string): ValidationResult {
    // Try to parse JSON
    let data: unknown;
    try {
        data = JSON.parse(jsonString);
    } catch (e) {
        const parseError = e instanceof SyntaxError ? e.message : 'Invalid JSON';
        return { valid: false, error: `Invalid JSON format. ${parseError}` };
    }

    // Check it's an object
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return { valid: false, error: 'Invalid plan format. Expected a JSON object.' };
    }

    const obj = data as Record<string, unknown>;

    // Check version
    if (!obj.version) {
        return { valid: false, error: 'Invalid plan format. Missing required field: `version`' };
    }
    if (obj.version !== SUPPORTED_VERSION) {
        return { valid: false, error: 'This plan was exported from an unsupported version.' };
    }

    // Check planName
    if (!obj.planName || typeof obj.planName !== 'string' || obj.planName.trim() === '') {
        return { valid: false, error: 'Invalid plan format. Missing required field: `planName`' };
    }
    if (obj.planName.length > 100) {
        return { valid: false, error: 'Plan name is too long (maximum 100 characters).' };
    }

    // Check durationWeeks
    if (!obj.durationWeeks || typeof obj.durationWeeks !== 'number') {
        return { valid: false, error: 'Invalid plan format. Missing required field: `durationWeeks`' };
    }
    if (obj.durationWeeks < 1 || obj.durationWeeks > 52) {
        return { valid: false, error: 'Duration must be between 1 and 52 weeks.' };
    }

    // Check workouts
    if (!obj.workouts || !Array.isArray(obj.workouts)) {
        return { valid: false, error: 'Invalid plan format. Missing required field: `workouts`' };
    }
    if (obj.workouts.length === 0) {
        return { valid: false, error: 'This plan has no workouts. Add at least one workout with exercises.' };
    }
    if (obj.workouts.length > 50) {
        return { valid: false, error: 'Too many workouts (maximum 50).' };
    }

    // Validate each workout
    let totalExercises = 0;
    for (const workout of obj.workouts) {
        if (!workout || typeof workout !== 'object') {
            return { valid: false, error: 'Invalid workout format in plan.' };
        }
        const w = workout as Record<string, unknown>;

        if (!w.name || typeof w.name !== 'string' || w.name.trim() === '') {
            return { valid: false, error: 'Each workout must have a name.' };
        }

        if (!w.exercises || !Array.isArray(w.exercises)) {
            return { valid: false, error: `Workout "${w.name}" must have an exercises array.` };
        }

        if (w.exercises.length === 0) {
            return { valid: false, error: `Workout "${w.name}" has no exercises. Each workout needs at least one exercise.` };
        }

        // Validate each exercise
        for (const exercise of w.exercises) {
            if (!exercise || typeof exercise !== 'object') {
                return { valid: false, error: `Invalid exercise in workout "${w.name}".` };
            }
            const e = exercise as Record<string, unknown>;

            if (!e.name || typeof e.name !== 'string' || e.name.trim() === '') {
                return { valid: false, error: `Each exercise in "${w.name}" must have a name.` };
            }

            totalExercises++;
        }
    }

    if (totalExercises > 200) {
        return { valid: false, error: 'Too many exercises (maximum 200). Try splitting into multiple plans.' };
    }

    return { valid: true, data: data as PlanExportData };
}

export function ImportPlanDialog({
    open,
    onOpenChange,
    onSuccess,
}: ImportPlanDialogProps) {
    // Mutation hooks
    const matchMutation = useMatchImportedPlan();
    const createMutation = useCreatePlanFromText();
    
    // File input ref
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Form state
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
    const [jsonInput, setJsonInput] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral validation state
    const [validationError, setValidationError] = useState<string | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral validation state
    const [isValidJson, setIsValidJson] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral parsed data
    const [parsedData, setParsedData] = useState<PlanExportData | null>(null);
    
    // Dialog step state
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [step, setStep] = useState<DialogStep>('input');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral preview data
    const [preview, setPreview] = useState<DraftPlan | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral error state
    const [error, setError] = useState<string | null>(null);
    
    // Derived loading states
    const isMatching = matchMutation.isPending;
    const isCommitting = createMutation.isPending;
    
    // Reset dialog state
    const resetDialog = useCallback(() => {
        setJsonInput('');
        setValidationError(null);
        setIsValidJson(false);
        setParsedData(null);
        setStep('input');
        setPreview(null);
        setError(null);
        matchMutation.reset();
        createMutation.reset();
    }, [matchMutation, createMutation]);
    
    // Handle dialog close
    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) {
            // Don't allow closing while committing
            if (isCommitting) return;
            resetDialog();
        }
        onOpenChange(newOpen);
    };
    
    // Validate JSON input
    const validateInput = useCallback((input: string) => {
        if (!input.trim()) {
            setValidationError(null);
            setIsValidJson(false);
            setParsedData(null);
            return;
        }

        const result = validateImportJson(input);
        if (result.valid && result.data) {
            setValidationError(null);
            setIsValidJson(true);
            setParsedData(result.data);
        } else {
            setValidationError(result.error || 'Invalid JSON');
            setIsValidJson(false);
            setParsedData(null);
        }
    }, []);
    
    // Handle JSON input change
    const handleJsonChange = (value: string) => {
        setJsonInput(value);
        validateInput(value);
    };
    
    // Handle paste from clipboard
    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                setJsonInput(text);
                validateInput(text);
            }
        } catch (err) {
            console.error('Failed to read clipboard:', err);
            toast.error('Clipboard access denied. Please paste manually (Ctrl+V / Cmd+V).');
        }
    };
    
    // Handle clear text
    const handleClear = () => {
        setJsonInput('');
        setValidationError(null);
        setIsValidJson(false);
        setParsedData(null);
    };
    
    // Handle file upload
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Check file size
        if (file.size > MAX_FILE_SIZE) {
            setValidationError('File is too large. Maximum size is 1MB.');
            return;
        }

        // Read file
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            if (content) {
                setJsonInput(content);
                validateInput(content);
            }
        };
        reader.onerror = () => {
            setValidationError('Could not read file. Make sure it\'s a valid JSON file.');
        };
        reader.readAsText(file);

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    
    // Handle continue to preview
    const handleContinue = () => {
        if (!parsedData) return;
        
        setError(null);
        
        matchMutation.mutate(
            { importData: parsedData },
            {
                onSuccess: (data) => {
                    if (data.preview) {
                        setPreview(data.preview);
                        setStep('preview');
                    }
                },
                onError: (err) => {
                    setError(err.message || 'Failed to process plan. Please try again.');
                },
            }
        );
    };
    
    // Handle back to input
    const handleBackToInput = () => {
        setStep('input');
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
                        toast.success(`Plan "${data.plan.name}" imported successfully!`);
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
    
    // Check if all exercises are resolved (no 'unresolved' status)
    const hasUnresolvedExercises = preview?.exercises.some(e => e.matchStatus === 'unresolved') ?? false;
    const canCommit = !hasUnresolvedExercises;
    
    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileJson className="h-5 w-5 text-primary" />
                        Import Plan from JSON
                    </DialogTitle>
                    {step === 'input' && (
                        <DialogDescription>
                            Paste or upload a previously exported plan JSON
                        </DialogDescription>
                    )}
                    {step === 'preview' && (
                        <DialogDescription>
                            Review the imported plan before saving
                        </DialogDescription>
                    )}
                </DialogHeader>
                
                {/* Input Step */}
                {step === 'input' && (
                    <div className="py-4 space-y-4">
                        {/* Action Buttons */}
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={handlePaste}
                                className="rounded-lg"
                            >
                                <ClipboardPaste className="h-4 w-4 mr-2" />
                                Paste from Clipboard
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                className="rounded-lg"
                            >
                                <Upload className="h-4 w-4 mr-2" />
                                Upload File
                            </Button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json,application/json"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                            {jsonInput && (
                                <Button
                                    variant="ghost"
                                    onClick={handleClear}
                                    className="rounded-lg ml-auto"
                                >
                                    <X className="h-4 w-4 mr-2" />
                                    Clear
                                </Button>
                            )}
                        </div>
                        
                        {/* JSON Textarea */}
                        <Textarea
                            value={jsonInput}
                            onChange={(e) => handleJsonChange(e.target.value)}
                            placeholder={`{
  "version": "1.0",
  "planName": "My Plan",
  "durationWeeks": 8,
  "workouts": [
    {
      "name": "Push Day",
      "exercises": [
        { "name": "Bench Press", "sets": 3, "reps": 8 }
      ]
    }
  ]
}`}
                            className="rounded-lg min-h-[300px] font-mono text-sm"
                        />
                        
                        {/* Validation Status */}
                        {jsonInput && (
                            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
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
                        
                        {/* API Error Display */}
                        {error && (
                            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}
                    </div>
                )}
                
                {/* Preview Step */}
                {step === 'preview' && preview && (
                    <>
                        <AiPlanPreview 
                            preview={preview} 
                            previewCost={null}
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
                {isMatching && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 rounded-2xl">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <div className="text-center">
                            <p className="font-medium">Matching exercises...</p>
                            <p className="text-sm text-muted-foreground">
                                Finding matches in your exercise library
                            </p>
                        </div>
                    </div>
                )}
                
                <DialogFooter className="gap-2">
                    {step === 'input' && (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => handleOpenChange(false)}
                                className="rounded-lg"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleContinue}
                                disabled={!isValidJson || isMatching}
                                className="rounded-lg"
                            >
                                {isMatching ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    'Continue'
                                )}
                            </Button>
                        </>
                    )}
                    
                    {step === 'preview' && (
                        <>
                            <Button
                                variant="outline"
                                onClick={handleBackToInput}
                                className="rounded-lg"
                                disabled={isCommitting}
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back
                            </Button>
                            <Button
                                onClick={handleCommit}
                                disabled={isCommitting || !canCommit}
                                className="rounded-lg"
                                title={!canCommit ? 'Resolve all exercises before importing' : undefined}
                            >
                                {isCommitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Importing...
                                    </>
                                ) : (
                                    <>
                                        <Check className="h-4 w-4 mr-2" />
                                        Import Plan
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
