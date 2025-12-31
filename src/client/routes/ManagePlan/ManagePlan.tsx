import { useState, useEffect } from 'react';
import { Button } from '@/client/components/ui/button';
import { Card } from '@/client/components/ui/card';
import { Skeleton } from '@/client/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/tabs';
import { ChevronLeft, Dumbbell, Bookmark, Check } from 'lucide-react';
import { useRouter } from '../../router';
import { useManagePlanStore } from './store';
import {
    usePlan,
    usePlanExercises,
    useExerciseLibrary,
    useAddPlanExercise,
    useBulkAddPlanExercises,
    useUpdatePlanExercise,
    useDeletePlanExercise,
    useReorderPlanExercises,
    useCreateExercise,
    useUpdateExercise,
    useDeleteExercise,
} from './hooks';
import {
    usePlanWorkouts,
    useCreatePlanWorkout,
    useUpdatePlanWorkout,
    useDeletePlanWorkout,
    useReorderPlanWorkouts,
} from '@/client/features/plan-workouts';
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

    // Queries
    const { data: planData, isLoading: planLoading } = usePlan(planId);
    const { data: exercisesData, isLoading: exercisesLoading } = usePlanExercises(planId);
    const { data: libraryData, isLoading: libraryLoading } = useExerciseLibrary();

    // Mutations
    const addExerciseMutation = useAddPlanExercise();
    const bulkAddMutation = useBulkAddPlanExercises();
    const updateExerciseMutation = useUpdatePlanExercise(planId);
    const deleteExerciseMutation = useDeletePlanExercise(planId);
    const reorderMutation = useReorderPlanExercises(planId);

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
    const planExercises = exercisesData?.exercises || [];
    const exerciseLibrary = libraryData?.exercises || [];

    const isLoading = planLoading || exercisesLoading;

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
            <ManagePlanHeader plan={plan} onBack={handleBack} />

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
