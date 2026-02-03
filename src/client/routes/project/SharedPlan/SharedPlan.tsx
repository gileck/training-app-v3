/**
 * SharedPlan Route Component
 * 
 * Public route that displays a shared plan preview and allows users to add it
 * to their own account. Handles authentication flow for unauthenticated users.
 * 
 * URL: /share/:token
 * 
 * Flow:
 * 1. Fetch shared plan data (public API)
 * 2. Convert to DraftPlan client-side (no matching API call)
 * 3. Show full plan preview using PlanPreview (without match badges)
 * 4. User clicks "Add to My Plans" -> create plan with autoResolveUnmatched=true
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/client/components/ui/button';
import { Card, CardContent } from '@/client/components/ui/card';
import { Skeleton } from '@/client/components/ui/skeleton';
import { AlertCircle, LogIn, Plus, Loader2, User } from 'lucide-react';
import { useRouter } from '@/client/router';
import { useAuthValidation } from '@/client/features/auth/hooks';
import { IOSAuthModal } from '@/client/features/auth/IOSAuthModal';
import { LoginForm } from '@/client/features/auth/LoginForm';
import { useSharedPlan, exportDataToDraftPlan } from './hooks';
import { PlanPreview } from '../TrainingPlans/components/PlanPreview';
import { useCreatePlanFromText } from '../TrainingPlans/hooks';
import { toast } from '@/client/components/ui/toast';

const SESSION_STORAGE_KEY = 'pendingShareAdd';

export function SharedPlan() {
    const { routeParams, navigate } = useRouter();
    const token = routeParams.token;
    
    // Auth state
    const { isAuthenticated, isValidated } = useAuthValidation();
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral modal state
    const [showLoginModal, setShowLoginModal] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral error state
    const [addError, setAddError] = useState<string | null>(null);
    
    // Fetch shared plan data
    const { data: sharedPlanData, isLoading, error } = useSharedPlan(token);
    
    // Convert export data to draft plan (client-side, no API call)
    const draftPlan = useMemo(() => {
        if (!sharedPlanData?.exportData) return null;
        return exportDataToDraftPlan(sharedPlanData.exportData);
    }, [sharedPlanData?.exportData]);
    
    // Create plan mutation
    const createMutation = useCreatePlanFromText();
    
    // Handle Login to Add click (unauthenticated users)
    const handleLoginToAdd = () => {
        // Store intent in sessionStorage (survives OAuth redirect/refresh)
        if (token) {
            sessionStorage.setItem(SESSION_STORAGE_KEY, token);
        }
        setShowLoginModal(true);
    };
    
    // Add plan to user's account
    const handleAddPlan = useCallback(() => {
        if (!draftPlan) return;
        
        setAddError(null);
        
        createMutation.mutate(
            {
                planName: draftPlan.planName,
                durationWeeks: draftPlan.durationWeeks,
                draft: draftPlan,
                autoResolveUnmatched: true, // Auto-create unmatched exercises as custom
                creationSource: 'share',
            },
            {
                onSuccess: (data) => {
                    if (data.plan) {
                        toast.success(`Plan "${data.plan.name}" added to your account!`);
                        navigate(`/training-plans/${data.plan._id}`);
                    }
                },
                onError: (err) => {
                    setAddError(err.message || 'Failed to add plan. Please try again.');
                },
            }
        );
    }, [draftPlan, createMutation, navigate]);
    
    // On auth change: check for pending action and auto-trigger
    useEffect(() => {
        if (isAuthenticated) {
            setShowLoginModal(false); // Close modal if open
            
            const pending = sessionStorage.getItem(SESSION_STORAGE_KEY);
            if (pending === token && draftPlan) {
                sessionStorage.removeItem(SESSION_STORAGE_KEY);
                handleAddPlan(); // Auto-trigger add flow
            }
        }
    }, [isAuthenticated, token, draftPlan, handleAddPlan]);
    
    // Handle login modal close
    const handleModalClose = (open: boolean) => {
        setShowLoginModal(open);
        if (!open && !isAuthenticated) {
            // User dismissed modal without logging in
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
        }
    };
    
    // iOS PWA detection
    const isStandalone = typeof window !== 'undefined' &&
        (window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone);
    const isMobile = typeof window !== 'undefined' 
        ? window.matchMedia('(max-width: 640px)').matches 
        : false;

    // Fullscreen wrapper for all states - handles iOS PWA safe areas
    const FullscreenWrapper = ({ children }: { children: React.ReactNode }) => (
        <div 
            className="fixed inset-0 z-50 bg-background overflow-y-auto"
            style={{
                // iOS PWA: Use dynamic viewport height and safe area insets
                height: isMobile ? '100dvh' : '100vh',
                paddingTop: isStandalone && isMobile ? 'env(safe-area-inset-top)' : undefined,
                paddingLeft: isStandalone && isMobile ? 'env(safe-area-inset-left)' : undefined,
                paddingRight: isStandalone && isMobile ? 'env(safe-area-inset-right)' : undefined,
                paddingBottom: isStandalone && isMobile ? 'env(safe-area-inset-bottom)' : undefined,
            }}
        >
            <div className="min-h-full flex flex-col">
                <div className="flex-1 p-4 pb-8 space-y-4 max-w-screen-lg mx-auto w-full">
                    {children}
                </div>
            </div>
        </div>
    );

    // Loading state
    if (isLoading) {
        return (
            <FullscreenWrapper>
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-64 rounded-2xl" />
                <Skeleton className="h-12 w-full rounded-lg" />
            </FullscreenWrapper>
        );
    }
    
    // Error state
    if (error || sharedPlanData?.error) {
        const errorMessage = error?.message || sharedPlanData?.error || 'Failed to load shared plan';
        const errorCode = sharedPlanData?.errorCode;
        
        return (
            <FullscreenWrapper>
                <h1 className="text-xl font-semibold">Shared Plan</h1>
                <Card className="rounded-2xl border-destructive bg-destructive/10">
                    <CardContent className="p-6 text-center">
                        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                        <h2 className="text-lg font-semibold mb-2">
                            {errorCode === 'INVALID_TOKEN' && 'Invalid Share Link'}
                            {errorCode === 'PLAN_NOT_FOUND' && 'Plan Not Found'}
                            {(!errorCode || errorCode === 'SERVER_ERROR') && 'Something Went Wrong'}
                        </h2>
                        <p className="text-muted-foreground mb-4">{errorMessage}</p>
                        <Button
                            variant="outline"
                            onClick={() => navigate('/')}
                            className="rounded-lg"
                        >
                            Go to Home
                        </Button>
                    </CardContent>
                </Card>
            </FullscreenWrapper>
        );
    }
    
    // No data (shouldn't happen but handle gracefully)
    if (!draftPlan) {
        return (
            <FullscreenWrapper>
                <p className="text-muted-foreground">No plan data available.</p>
            </FullscreenWrapper>
        );
    }
    
    return (
        <FullscreenWrapper>
            {/* Header with owner info */}
            <div className="flex justify-between items-start">
                <h1 className="text-xl font-semibold">Shared Plan</h1>
                {sharedPlanData?.ownerName && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                        <User className="h-3 w-3" />
                        <span>Shared by {sharedPlanData.ownerName}</span>
                    </div>
                )}
            </div>
            
            {/* Plan Preview - using PlanPreview without match status */}
            <PlanPreview 
                preview={draftPlan}
                showMatchStatus={false}
            />
            
            {/* Add Error */}
            {addError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{addError}</span>
                </div>
            )}
            
            {/* Action Button - different based on auth state */}
            {isValidated && isAuthenticated ? (
                <Button
                    onClick={handleAddPlan}
                    disabled={createMutation.isPending}
                    className="w-full rounded-lg"
                    size="lg"
                >
                    {createMutation.isPending ? (
                        <>
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            Adding...
                        </>
                    ) : (
                        <>
                            <Plus className="h-5 w-5 mr-2" />
                            Add to My Plans
                        </>
                    )}
                </Button>
            ) : (
                <Button
                    onClick={handleLoginToAdd}
                    className="w-full rounded-lg"
                    size="lg"
                >
                    <LogIn className="h-5 w-5 mr-2" />
                    Login to Add Plan
                </Button>
            )}
            
            {/* Login Modal */}
            <IOSAuthModal isOpen={showLoginModal} onOpenChange={handleModalClose}>
                <LoginForm />
            </IOSAuthModal>
        </FullscreenWrapper>
    );
}
