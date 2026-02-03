/**
 * Import Plan Dialog
 * 
 * Two-step dialog: JSON input → preview & import
 * 
 * Simplified flow (same as Share):
 * 1. User pastes/uploads JSON
 * 2. Client-side conversion to DraftPlan (no server matching)
 * 3. Preview plan (no resolution UI needed)
 * 4. Single click to import with autoResolveUnmatched=true
 */

import { useState, useCallback, useRef, useMemo } from 'react';
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
    ClipboardPaste,
    X,
    Check,
    AlertCircle,
    FileJson,
} from 'lucide-react';
import type { PlanExportData } from '@/apis/training-plans/types';
import { toast } from '@/client/components/ui/toast';
import { PlanPreviewCommit } from './PlanPreviewCommit';
import { exportDataToDraftPlan, validatePlanExportJson } from '../utils';

// Validation limits (matching server)
const MAX_FILE_SIZE = 1024 * 1024; // 1MB

interface ImportPlanDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: (planId: string) => void;
}

type DialogStep = 'input' | 'preview';

export function ImportPlanDialog({
    open,
    onOpenChange,
    onSuccess,
}: ImportPlanDialogProps) {
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
    
    // Convert parsed data to draft plan (client-side, no API call)
    const draftPlan = useMemo(() => {
        if (!parsedData) return null;
        return exportDataToDraftPlan(parsedData);
    }, [parsedData]);
    
    // Reset dialog state
    const resetDialog = useCallback(() => {
        setJsonInput('');
        setValidationError(null);
        setIsValidJson(false);
        setParsedData(null);
        setStep('input');
    }, []);
    
    // Handle dialog close
    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) {
            resetDialog();
        }
        onOpenChange(newOpen);
    };
    
    // Validate JSON input (uses shared validation which handles code fences)
    const validateInput = useCallback((input: string) => {
        if (!input.trim()) {
            setValidationError(null);
            setIsValidJson(false);
            setParsedData(null);
            return;
        }

        const result = validatePlanExportJson(input);
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
        if (!parsedData || !draftPlan) return;
        setStep('preview');
    };
    
    // Handle back to input
    const handleBackToInput = () => {
        setStep('input');
    };
    
    // Handle plan import success
    const handleImportSuccess = (planId: string) => {
        toast.success('Plan imported successfully!');
        onSuccess(planId);
        handleOpenChange(false);
    };
    
    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                            >
                                <ClipboardPaste className="h-4 w-4 mr-2" />
                                Paste from Clipboard
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
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
                                    className="ml-auto"
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
                            className="min-h-[300px] font-mono text-sm"
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
                    </div>
                )}
                
                {/* Preview Step - uses shared PlanPreviewCommit component */}
                {step === 'preview' && draftPlan && (
                    <PlanPreviewCommit
                        initialPreview={draftPlan}
                        onSuccess={handleImportSuccess}
                        onBack={handleBackToInput}
                        submitLabel="Import Plan"
                        showMatchStatus={false}
                        autoResolveUnmatched={true}
                    />
                )}
                
                {/* Footer only for input step */}
                {step === 'input' && (
                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleContinue}
                            disabled={!isValidJson}
                        >
                            Continue
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
