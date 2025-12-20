import { Card, CardContent } from '@/client/components/ui/card';
import { Button } from '@/client/components/ui/button';
import { Badge } from '@/client/components/ui/badge';
import { Skeleton } from '@/client/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/tabs';
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    Minus,
    CheckCheck,
    Check,
    Info,
    Dumbbell,
    Calendar,
    LayoutGrid,
    List,
    Settings2,
    ChevronDown,
    ChevronUp,
    Play,
    Bookmark,
} from 'lucide-react';
import { useState } from 'react';
import { useRouter } from '../../router';
import {
    useWorkoutStore,
    useCurrentWeek,
    useActivePlanId,
    useViewMode,
    useActiveTab,
    useSyncActivePlan,
    useWeekProgress,
    useUpdateSets,
} from '@/client/features/workout';
import type { WorkoutTab } from '@/client/features/workout';
import type { ExerciseWeekProgress } from '@/apis/weekly-progress/types';

export function Home() {
    const { navigate } = useRouter();

    // Workout store state
    const currentWeek = useCurrentWeek();
    const activePlanId = useActivePlanId();
    const viewMode = useViewMode();
    const activeTab = useActiveTab();
    const setWeek = useWorkoutStore((state) => state.setWeek);
    const setViewMode = useWorkoutStore((state) => state.setViewMode);
    const setActiveTab = useWorkoutStore((state) => state.setActiveTab);

    // Sync active plan from server
    const { activePlan, plans } = useSyncActivePlan();

    // Week progress data
    const {
        data: weekData,
        isLoading: weekLoading,
        isFetching,
    } = useWeekProgress(activePlanId, currentWeek);

    // Update sets mutation
    const updateSetsMutation = useUpdateSets();

    // Local UI state
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state
    const [completedExpanded, setCompletedExpanded] = useState(false);

    const exercises = weekData?.exercises || [];
    const incompleteExercises = exercises.filter((e) => !e.isDone);
    const completedExercises = exercises.filter((e) => e.isDone);

    const totalSets = weekData?.totalSets || 0;
    const completedSets = weekData?.completedSets || 0;
    const progressPercent = weekData?.progressPercent || 0;

    const handlePrevWeek = () => {
        if (currentWeek > 1) {
            setWeek(currentWeek - 1);
        }
    };

    const handleNextWeek = () => {
        if (activePlan && currentWeek < activePlan.durationWeeks) {
            setWeek(currentWeek + 1);
        }
    };

    const handleAddSet = (exercise: ExerciseWeekProgress) => {
        if (!activePlanId || exercise.setsCompleted >= exercise.targetSets) return;

        updateSetsMutation.mutate({
            planId: activePlanId,
            planExerciseId: exercise.planExerciseId,
            weekNumber: currentWeek,
            action: 'add',
        });
    };

    const handleRemoveSet = (exercise: ExerciseWeekProgress) => {
        if (!activePlanId || exercise.setsCompleted <= 0) return;

        updateSetsMutation.mutate({
            planId: activePlanId,
            planExerciseId: exercise.planExerciseId,
            weekNumber: currentWeek,
            action: 'remove',
        });
    };

    const handleCompleteAll = (exercise: ExerciseWeekProgress) => {
        if (!activePlanId) return;

        const remaining = exercise.targetSets - exercise.setsCompleted;
        if (remaining > 0) {
            updateSetsMutation.mutate({
                planId: activePlanId,
                planExerciseId: exercise.planExerciseId,
                weekNumber: currentWeek,
                action: 'complete-all',
                targetSets: exercise.targetSets,
            });
        }
    };

    const getMotivationalMessage = (percent: number) => {
        if (percent === 0) return "Let's get started! 💪";
        if (percent < 25) return 'Great start!';
        if (percent < 50) return 'Keep pushing!';
        if (percent < 75) return 'Halfway there! 🔥';
        if (percent < 100) return 'Almost done!';
        return 'Week complete! 🏆';
    };

    // No plan selected
    if (!activePlanId || !activePlan) {
        return (
            <div className="p-4 pb-20 space-y-4">
                <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">
                            {plans.length === 0 ? 'No training plans' : 'No active plan'}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4 text-center">
                            {plans.length === 0
                                ? 'Create a training plan to start tracking your workouts'
                                : 'Set a plan as active to start tracking'}
                        </p>
                        <Button onClick={() => navigate('/training-plans')}>
                            <Calendar className="mr-2 h-4 w-4" />
                            {plans.length === 0 ? 'Create Plan' : 'View Plans'}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Loading state
    if (weekLoading && !weekData) {
        return (
            <div className="p-4 pb-20 space-y-4">
                {/* Week Navigator Skeleton */}
                <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-4">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <Skeleton className="h-6 w-32" />
                            <Skeleton className="h-10 w-10 rounded-full" />
                        </div>
                        <Skeleton className="h-3 w-full rounded-full mb-2" />
                        <div className="flex justify-between">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-24" />
                        </div>
                    </CardContent>
                </Card>

                {/* Exercise Cards Skeleton */}
                {[1, 2, 3].map((i) => (
                    <Card key={i} className="rounded-2xl border-0 shadow-sm">
                        <CardContent className="p-4">
                            <div className="flex gap-4 mb-3">
                                <Skeleton className="h-20 w-20 rounded-xl" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-5 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                    <Skeleton className="h-4 w-1/4" />
                                </div>
                            </div>
                            <Skeleton className="h-2 w-full rounded-full" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

  return (
        <div className="p-4 pb-20 space-y-4">
            {/* Week Navigator + Progress */}
            <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                <CardContent className="relative p-4 space-y-4">
                    {/* Week Navigation */}
                    <div className="flex items-center justify-between">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handlePrevWeek}
                            disabled={currentWeek <= 1 || isFetching}
                            className="h-10 w-10 rounded-full"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <div className="text-center">
                            <p className="text-xl font-bold tracking-tight">
                                WEEK {currentWeek} / {activePlan.durationWeeks}
                            </p>
                            <button
                                onClick={() => navigate('/training-plans')}
                                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mx-auto"
                            >
                                {activePlan.name}
                                <Settings2 className="h-3 w-3" />
                            </button>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleNextWeek}
                            disabled={currentWeek >= activePlan.durationWeeks || isFetching}
                            className="h-10 w-10 rounded-full"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </Button>
                    </div>

                    {/* Progress */}
                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <p className="text-sm font-medium text-muted-foreground">Weekly Progress</p>
                            <p className="text-2xl font-bold text-primary">{progressPercent}%</p>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ease-out ${
                                    progressPercent >= 100
                                        ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                                        : 'bg-gradient-to-r from-primary to-primary/80'
                                }`}
                                style={{ width: `${Math.min(progressPercent, 100)}%` }}
                            />
                        </div>
                        <div className="flex justify-between mt-2">
                            <p className="text-sm text-muted-foreground">
                                Sets: {completedSets}/{totalSets}
                            </p>
                            <p className="text-sm font-medium">{getMotivationalMessage(progressPercent)}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as WorkoutTab)} className="w-full">
                <div className="flex items-center justify-between gap-2">
                    <TabsList className="bg-muted p-1 rounded-xl flex-1">
                        <TabsTrigger value="exercises" className="flex-1 rounded-lg text-sm font-medium">
                            Exercises
                        </TabsTrigger>
                        <TabsTrigger value="workouts" className="flex-1 rounded-lg text-sm font-medium">
                            Workouts
                        </TabsTrigger>
                        <TabsTrigger value="active" className="flex-1 rounded-lg text-sm font-medium">
                            Active
                        </TabsTrigger>
                    </TabsList>
                    
                    {/* View Toggle */}
                    <div className="bg-muted rounded-lg p-1 flex gap-1">
                        <Button
                            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('grid')}
                            className="h-8 w-8 p-0 rounded-md"
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('list')}
                            className="h-8 w-8 p-0 rounded-md"
                        >
                            <List className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Exercises Tab Content */}
                <TabsContent value="exercises" className="mt-4 space-y-4">
                    {/* No exercises */}
                    {exercises.length === 0 && (
                        <Card className="rounded-2xl border-0 shadow-sm">
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <Dumbbell className="h-12 w-12 text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">No exercises in this plan</h3>
                                <p className="text-sm text-muted-foreground mb-4 text-center">
                                    Add exercises to start tracking your workouts
                                </p>
                                <Button onClick={() => navigate(`/training-plans/${activePlanId}`)}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Exercises
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Incomplete Exercises */}
                    {incompleteExercises.length > 0 && (
                        <div className="space-y-3">
                            {incompleteExercises.map((exercise) =>
                                viewMode === 'grid' ? (
                                    <ExerciseCardGrid
                                        key={exercise.planExerciseId}
                                        exercise={exercise}
                                        onAddSet={() => handleAddSet(exercise)}
                                        onRemoveSet={() => handleRemoveSet(exercise)}
                                        onCompleteAll={() => handleCompleteAll(exercise)}
                                    />
                                ) : (
                                    <ExerciseCardList
                                        key={exercise.planExerciseId}
                                        exercise={exercise}
                                        onAddSet={() => handleAddSet(exercise)}
                                        onRemoveSet={() => handleRemoveSet(exercise)}
                                        onCompleteAll={() => handleCompleteAll(exercise)}
                                    />
                                )
                            )}
                        </div>
                    )}

                    {/* Completed Exercises Section */}
                    {completedExercises.length > 0 && (
                        <div className="space-y-3">
                            <button
                                onClick={() => setCompletedExpanded(!completedExpanded)}
                                className="flex items-center justify-between w-full py-2 text-left"
                            >
                                <span className="text-sm font-medium text-muted-foreground">
                                    Completed Exercises ({completedExercises.length})
                                </span>
                                {completedExpanded ? (
                                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                            </button>

                            {completedExpanded && (
                                <div className="space-y-3">
                                    {completedExercises.map((exercise) =>
                                        viewMode === 'grid' ? (
                                            <ExerciseCardGrid
                                                key={exercise.planExerciseId}
                                                exercise={exercise}
                                                onAddSet={() => handleAddSet(exercise)}
                                                onRemoveSet={() => handleRemoveSet(exercise)}
                                                onCompleteAll={() => {}}
                                                isComplete
                                            />
                                        ) : (
                                            <ExerciseCardList
                                                key={exercise.planExerciseId}
                                                exercise={exercise}
                                                onAddSet={() => handleAddSet(exercise)}
                                                onRemoveSet={() => handleRemoveSet(exercise)}
                                                onCompleteAll={() => {}}
                                                isComplete
                                            />
                                        )
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </TabsContent>

                {/* Workouts Tab Content */}
                <TabsContent value="workouts" className="mt-4">
                    <Card className="rounded-2xl border-0 shadow-sm">
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <Bookmark className="h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">Saved Workouts</h3>
                            <p className="text-sm text-muted-foreground mb-4 text-center">
                                Save combinations of exercises as reusable workouts
                            </p>
                            <Button variant="secondary">
                                <Plus className="mr-2 h-4 w-4" />
                                Create Workout
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Active Workout Tab Content */}
                <TabsContent value="active" className="mt-4">
                    <Card className="rounded-2xl border-0 shadow-sm">
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <Play className="h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No Active Workout</h3>
                            <p className="text-sm text-muted-foreground mb-4 text-center">
                                Start a workout session to track your exercises with rest timers
                            </p>
                            <Button>
                                <Play className="mr-2 h-4 w-4" />
                                Start Workout
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
    </div>
  );
}

// Exercise Card Components
interface ExerciseCardProps {
    exercise: ExerciseWeekProgress;
    onAddSet: () => void;
    onRemoveSet: () => void;
    onCompleteAll: () => void;
    isComplete?: boolean;
}

function ExerciseCardGrid({
    exercise,
    onAddSet,
    onRemoveSet,
    onCompleteAll,
    isComplete,
}: ExerciseCardProps) {
    const progress = (exercise.setsCompleted / exercise.targetSets) * 100;

    return (
        <Card
            className={`rounded-2xl border-0 shadow-sm transition-all ${
                isComplete ? 'border-2 border-green-500/50 bg-green-500/5' : ''
            }`}
        >
            <CardContent className="p-4">
                <div className="flex gap-4 mb-3">
                    {/* Image with completion badge */}
                    <div className="relative flex-shrink-0">
                        <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden">
                            {exercise.exerciseDef.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={exercise.exerciseDef.imageUrl}
                                    alt={exercise.exerciseDef.name}
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Dumbbell className="h-8 w-8 text-muted-foreground" />
                                </div>
                            )}
                        </div>
                        {/* Completion badge */}
                        {isComplete && (
                            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
                                <Check className="h-4 w-4 text-white" strokeWidth={3} />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-lg truncate">{exercise.exerciseDef.name}</h3>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-primary">
                                <Info className="h-4 w-4" />
                            </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {exercise.planExercise.reps} reps
                            {exercise.planExercise.weight > 0 && ` • ${exercise.planExercise.weight}kg`}
                        </p>
                        <p className={`text-base font-semibold mt-1 ${isComplete ? 'text-green-500' : ''}`}>
                            Sets: {exercise.setsCompleted}/{exercise.targetSets}
                            {isComplete && ' ✓'}
                        </p>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
                    <div
                        className={`h-full rounded-full transition-all duration-300 ${
                            isComplete
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                                : 'bg-gradient-to-r from-primary to-primary/80'
                        }`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <Badge
                        variant="outline"
                        className="bg-[hsl(210,100%,95%)] text-[hsl(210,100%,40%)] border-[hsl(210,100%,85%)] dark:bg-[hsl(210,100%,20%)] dark:text-[hsl(210,100%,80%)]"
                    >
                        {exercise.exerciseDef.primaryMuscle}
                    </Badge>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={onRemoveSet}
                            disabled={exercise.setsCompleted <= 0}
                            className="h-11 w-11 rounded-full border-2 active:scale-95 transition-transform"
                        >
                            <Minus className="h-5 w-5" />
                        </Button>
                        <Button
                            size="icon"
                            onClick={onAddSet}
                            disabled={exercise.setsCompleted >= exercise.targetSets}
                            className="h-11 w-11 rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25 active:scale-95 transition-transform"
                        >
                            <Plus className="h-6 w-6" />
                        </Button>
                        {!isComplete && (
                            <Button
                                size="icon"
                                onClick={onCompleteAll}
                                className="h-11 w-11 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/30 active:scale-95 transition-transform"
                            >
                                <CheckCheck className="h-6 w-6" />
                            </Button>
                        )}
                        {isComplete && (
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-11 w-11 rounded-full text-green-500 border-2 border-green-500/50 bg-green-500/10"
                                disabled
                            >
                                <CheckCheck className="h-5 w-5" />
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function ExerciseCardList({
    exercise,
    onAddSet,
    onRemoveSet,
    onCompleteAll,
    isComplete,
}: ExerciseCardProps) {
    const progress = (exercise.setsCompleted / exercise.targetSets) * 100;

    return (
        <Card
            className={`rounded-xl border-0 shadow-sm transition-all ${
                isComplete ? 'border-2 border-green-500/50 bg-green-500/5' : ''
            }`}
        >
            <CardContent className="p-3">
                <div className="flex items-center gap-3">
                    {/* Image with completion badge */}
                    <div className="relative flex-shrink-0">
                        <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden">
                            {exercise.exerciseDef.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={exercise.exerciseDef.imageUrl}
                                    alt={exercise.exerciseDef.name}
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Dumbbell className="h-5 w-5 text-muted-foreground" />
                                </div>
                            )}
                        </div>
                        {/* Completion badge */}
                        {isComplete && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
                                <Check className="h-3 w-3 text-white" strokeWidth={3} />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{exercise.exerciseDef.name}</h3>
                        <p className={`text-sm ${isComplete ? 'text-green-500' : 'text-muted-foreground'}`}>
                            {exercise.setsCompleted}/{exercise.targetSets} sets{isComplete && ' ✓'}
                        </p>
                    </div>
                    <div className="flex gap-1">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={onRemoveSet}
                            disabled={exercise.setsCompleted <= 0}
                            className="h-9 w-9 rounded-full active:scale-95 transition-transform"
                        >
                            <Minus className="h-4 w-4" />
                        </Button>
                        <Button
                            size="icon"
                            onClick={onAddSet}
                            disabled={exercise.setsCompleted >= exercise.targetSets}
                            className="h-9 w-9 rounded-full active:scale-95 transition-transform"
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                        {!isComplete && (
                            <Button
                                size="icon"
                                onClick={onCompleteAll}
                                className="h-9 w-9 rounded-full bg-green-500 hover:bg-green-600 active:scale-95 transition-transform"
                            >
                                <CheckCheck className="h-4 w-4" />
                            </Button>
                        )}
                        {isComplete && (
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={onRemoveSet}
                                className="h-9 w-9 rounded-full text-red-500 border-red-500/50 hover:bg-red-500/10 active:scale-95 transition-transform"
                            >
                                <Minus className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                    <div
                        className={`h-full rounded-full transition-all duration-300 ${
                            isComplete
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                                : 'bg-gradient-to-r from-primary to-primary/80'
                        }`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
