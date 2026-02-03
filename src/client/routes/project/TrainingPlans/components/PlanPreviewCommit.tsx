/**
 * Plan Preview & Commit Component
 * 
 * Shared component for displaying a DraftPlan preview and committing it.
 * 
 * Used by:
 * - ImportPlanDialog (showMatchStatus=false, autoResolveUnmatched=true)
 * - SharedPlan (showMatchStatus=false, autoResolveUnmatched=true)
 * 
 * NOT used by:
 * - CreatePlanWithAiDialog (needs "Regenerate" button, custom AI cost, exercise resolution)
 */

import { useState } from 'react';
import { Button } from '@/client/components/template/ui/button';
import { AlertCircle, ArrowLeft, Loader2, Check } from 'lucide-react';
import { useCreatePlanFromText } from '../hooks';
import type { DraftPlan } from '@/apis/training-plans/types';
import type { PlanCreationSource } from '@/server/database/collections/trainingPlans/types';
import { toast } from '@/client/components/template/ui/toast';
import { PlanPreview } from './PlanPreview';

interface PlanPreviewCommitProps {
    /** The draft plan to preview and commit */
    initialPreview: DraftPlan;
    /** Called when plan is successfully created */
    onSuccess: (planId: string) => void;
    /** Optional back button callback */
    onBack?: () => void;
    /** Custom submit button label (default: "Create Plan") */
    submitLabel?: string;
    /** Optional: disable the form while parent is processing */
    disabled?: boolean;
    /** 
     * When true, unresolved exercises are auto-created as custom exercises.
     * Use true for import/share flows, false for AI flow (requires user resolution).
     * Default: true (simplified flow)
     */
    autoResolveUnmatched?: boolean;
    /**
     * Show match status badges and resolution UI in preview.
     * Default: false (simplified flow - no resolution needed)
     */
    showMatchStatus?: boolean;
    /**
     * How the plan was created (ai, import, share).
     * Default: 'import' (most common use case for this component)
     */
    creationSource?: PlanCreationSource;
}

export function PlanPreviewCommit({
    initialPreview,
    onSuccess,
    onBack,
    submitLabel = 'Create Plan',
    disabled = false,
    autoResolveUnmatched = true,
    showMatchStatus = false,
    creationSource = 'import',
}: PlanPreviewCommitProps) {
    // Mutation hook
    const createMutation = useCreatePlanFromText();
    
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral error state
    const [error, setError] = useState<string | null>(null);
    
    // Derived states
    const isCommitting = createMutation.isPending;
    const canCommit = !disabled;
    
    // Handle commit plan
    const handleCommit = () => {
        setError(null);
        
        createMutation.mutate(
            {
                planName: initialPreview.planName,
                durationWeeks: initialPreview.durationWeeks,
                draft: initialPreview,
                autoResolveUnmatched,
                creationSource,
            },
            {
                onSuccess: (data) => {
                    if (data.plan) {
                        toast.success(`Plan "${data.plan.name}" created successfully!`);
                        onSuccess(data.plan._id);
                    }
                },
                onError: (err) => {
                    setError(err.message || 'Failed to create plan. Please try again.');
                },
            }
        );
    };
    
    return (
        <div className="space-y-4">
            {/* Back Button */}
            {onBack && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBack}
                    disabled={isCommitting}
                    className="rounded-lg"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
            )}
            
            {/* Plan Preview */}
            <PlanPreview 
                preview={initialPreview} 
                showMatchStatus={showMatchStatus}
            />
            
            {/* Error Display */}
            {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}
            
            {/* Submit Button */}
            <Button
                onClick={handleCommit}
                disabled={!canCommit || isCommitting}
                className="w-full rounded-lg"
            >
                {isCommitting ? (
                    <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                    </>
                ) : (
                    <>
                        <Check className="h-4 w-4 mr-2" />
                        {submitLabel}
                    </>
                )}
            </Button>
        </div>
    );
}
