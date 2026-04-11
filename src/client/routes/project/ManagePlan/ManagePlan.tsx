import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/client/components/template/ui/button';
import { Card } from '@/client/components/template/ui/card';
import { Skeleton } from '@/client/components/template/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/project/ui/tabs';
import { ChevronLeft, Dumbbell, Bookmark, Check } from 'lucide-react';
import { useRouter } from '@/client/features';
import { useManagePlanStore } from './store';
import {
    usePlan,
    useExerciseLibrary,
    useCreateExercise,
    useUpdateExercise,
    useDeleteExercise,
} from './hooks';
import {
    useLoadPlan,
    usePlanExercisesFromStore,
    useAddPlanExerciseAdapter,
    useBulkAddPlanExercisesAdapter,
    useUpdatePlanExerciseAdapter,
    useUpdatePlanExerciseOverridesAdapter,
    useDeletePlanExerciseAdapter,
    useReorderPlanExercisesAdapter,
    useSyncFromCloud,
    usePlanLoading,
    usePlanConflict,
    forceSyncToServer,
    useClearAllPlanData,
} from '@/client/features/project/plan-data';
import {
    usePlanWorkouts,
    useCreatePlanWorkout,
    useUpdatePlanWorkout,
    useDeletePlanWorkout,
    useReorderPlanWorkouts,
} from '@/client/features/project/plan-workouts';
import { ManagePlanHeader } from './components/ManagePlanHeader';
import { ExercisesTab } from './components/exercises/ExercisesTab';
import { WorkoutsTab } from './components/workouts/WorkoutsTab';

interface ManagePlanProps {
    /** Optional planId - if not provided, will use routeParams.planId */
    planId?: string;
    /** Optional callback for back navigation - if not provided, will navigate to /training-plans */
    onBack?: () => void;
}

export function ManagePlan({ planId: propPlanId, onBack }: ManagePlanProps = {}) {
    const { navigate, routeParams, queryParams } = useRouter();
    const planId = propPlanId || routeParams.planId || '';

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            navigate('/training-plans');
        }
    };

    // Queries (React Query - kept for plan metadata and exercise library)
    const { data: planData, isLoading: planLoading } = usePlan(planId);
    const { data: libraryData, isLoading: libraryLoading } = useExerciseLibrary();

    // Plan data from local-first store
    useLoadPlan(planId, 1); // Load plan data on mount
    const planExercisesFromStore = usePlanExercisesFromStore(planId);
    const storeLoading = usePlanLoading(planId);

    // Get exercise library for adapters
    const exerciseLibrary = libraryData?.exercises || [];

    // Mutations via store adapters (local-first)
    const addExerciseMutation = useAddPlanExerciseAdapter(planId, exerciseLibrary);
    const bulkAddMutation = useBulkAddPlanExercisesAdapter(planId, exerciseLibrary);
    const updateExerciseMutation = useUpdatePlanExerciseAdapter(planId);
    const updateOverridesMutation = useUpdatePlanExerciseOverridesAdapter(planId);
    const deleteExerciseMutation = useDeletePlanExerciseAdapter(planId);
    const reorderMutation = useReorderPlanExercisesAdapter(planId);

    // Sync from cloud and conflict state
    const { sync: syncFromCloud, isSyncing } = useSyncFromCloud(planId, 1);
    const conflict = usePlanConflict(planId);
    const clearAllPlanData = useClearAllPlanData();

    // Custom exercise mutations
    const createExerciseMutation = useCreateExercise();
    const updateExerciseDefMutation = useUpdateExercise();
    const deleteExerciseDefMutation = useDeleteExercise();

    // Plan workouts (scoped to this plan)
    const { data: planWorkoutsData, isLoading: planWorkoutsLoading } = usePlanWorkouts(planId);
    const createWorkoutMutation = useCreatePlanWorkout(planId);
    const updateWorkoutMutation = useUpdatePlanWorkout(planId);
    const deleteWorkoutMutation = useDeletePlanWorkout(planId);
    const reorderWorkoutsMutation = useReorderPlanWorkouts(planId);
    const planWorkoutsList = planWorkoutsData?.workouts || [];
    const hasPlanWorkoutsData = planWorkoutsData !== undefined;

    // Persistent UI state from store
    const activeTab = useManagePlanStore((state) => state.activeTab);
    const setActiveTab = useManagePlanStore((state) => state.setActiveTab);

    // Update tab when query param changes (for deep linking)
    useEffect(() => {
        if (queryParams.tab === 'workouts') {
            setActiveTab('workouts');
        }
    }, [queryParams.tab, setActiveTab]);

    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral success message
    const [addSuccessMessage, setAddSuccessMessage] = useState<string | null>(null);

    const handleExerciseAdded = (message: string) => {
        setAddSuccessMessage(message);
        setTimeout(() => setAddSuccessMessage(null), 3000);
    };

    const plan = planData?.plan;
    const planExercises = planExercisesFromStore;

    const isLoading = planLoading || storeLoading;

    // Wrap sync for the header
    const handleSyncFromCloud = useCallback(async () => {
        await syncFromCloud();
    }, [syncFromCloud]);

    // Force sync to server (override server changes)
    const handleForceSyncToServer = useCallback(async () => {
        await forceSyncToServer(planId);
    }, [planId]);

    // Clear plan cache handler
    const handleClearPlanCache = useCallback(() => {
        clearAllPlanData();
    }, [clearAllPlanData]);

    // Loading state
    if (isLoading && !plan) {
        return (
            <div className="p-4 pb-20 space-y-4">
                <div className="flex items-center gap-3 mb-4">
                    <Skeleton className="h-10 w-10" />
                    <Skeleton className="h-6 w-48" />
                </div>
                {[1, 2, 3].map((i) => (
                    <Card key={i} className="rounded-xl">
                        <div className="p-3 flex items-center gap-3">
                            <Skeleton className="h-16 w-16 rounded-lg" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-5 w-32" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        );
    }

    if (!plan) {
        return (
            <div className="p-4 pb-20">
                <Button
                    variant="ghost"
                    onClick={handleBack}
                    className="mb-4"
                >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
                <Card className="rounded-2xl border-destructive bg-destructive/10 p-4">
                    <p className="text-destructive">Plan not found</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-4 pb-20 space-y-4">
            {/* Success toast - shown at page level */}
            {addSuccessMessage && (
                <div className="fixed top-4 left-4 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-success text-success-foreground rounded-xl shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
                    <Check className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-medium">{addSuccessMessage}</span>
                </div>
            )}

            {/* Header */}
            <ManagePlanHeader 
                plan={plan} 
                onBack={handleBack}
                onSyncFromCloud={handleSyncFromCloud}
                onForceSyncToServer={handleForceSyncToServer}
                onClearPlanCache={handleClearPlanCache}
                isSyncing={isSyncing}
                conflict={conflict}
            />

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'exercises' | 'workouts')} className="w-full">
                <TabsList className="w-full bg-muted p-1 rounded-xl">
                    <TabsTrigger value="exercises" className="flex-1 rounded-lg text-sm font-medium">
                        <Dumbbell className="h-4 w-4 mr-2" />
                        Exercises
                    </TabsTrigger>
                    <TabsTrigger value="workouts" className="flex-1 rounded-lg text-sm font-medium">
                        <Bookmark className="h-4 w-4 mr-2" />
                        Workouts
                    </TabsTrigger>
                </TabsList>

                {/* Exercises Tab */}
                <TabsContent value="exercises" className="mt-4">
                    <ExercisesTab
                        planId={planId}
                        planExercises={planExercises}
                        exerciseLibrary={exerciseLibrary}
                        isLibraryLoading={libraryLoading}
                        addExerciseMutation={addExerciseMutation}
                        bulkAddMutation={bulkAddMutation}
                        updateExerciseMutation={updateExerciseMutation}
                        updateOverridesMutation={updateOverridesMutation}
                        deleteExerciseMutation={deleteExerciseMutation}
                        reorderMutation={reorderMutation}
                        createExerciseMutation={createExerciseMutation}
                        updateExerciseDefMutation={updateExerciseDefMutation}
                        deleteExerciseDefMutation={deleteExerciseDefMutation}
                        onExerciseAdded={handleExerciseAdded}
                    />
                </TabsContent>

                {/* Workouts Tab */}
                <TabsContent value="workouts" className="mt-4">
                    <WorkoutsTab
                        planId={planId}
                        planExercises={planExercises}
                        planWorkouts={planWorkoutsList}
                        isLoading={planWorkoutsLoading}
                        hasData={hasPlanWorkoutsData}
                        createWorkoutMutation={createWorkoutMutation}
                        updateWorkoutMutation={updateWorkoutMutation}
                        deleteWorkoutMutation={deleteWorkoutMutation}
                        reorderWorkoutsMutation={reorderWorkoutsMutation}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
