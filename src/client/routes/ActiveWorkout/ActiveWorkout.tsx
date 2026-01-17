import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/tabs';
import { ExerciseDetails } from '@/client/components/ExerciseDetails/ExerciseDetails';
import type { ExerciseWeekProgress } from '@/apis/weekly-progress/types';
import type { ActiveWorkoutTab } from '@/client/features/workout';
import {
    AllExercisesView,
    EmptyState,
    ContextBar,
    TimerZone,
    WorkoutCompleteCard,
    WorkoutCardContainer,
    ExercisesTabContent,
} from './components';
import {
    SaveWorkoutDialog,
    RestManagementDialog,
    SupersetSelectionDialog,
    EndWorkoutConfirmation,
    WarmupDialog,
} from './dialogs';
import { useActiveWorkoutState, useWorkoutHandlers } from './hooks';

export function ActiveWorkout() {
    const state = useActiveWorkoutState();
    const handlers = useWorkoutHandlers(state);

    // Exercise details dialog state (must be before early returns)
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [exerciseDetailsOpen, setExerciseDetailsOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog context
    const [selectedExerciseForDetails, setSelectedExerciseForDetails] = useState<ExerciseWeekProgress | null>(null);

    const handleOpenExerciseDetails = (exercise: ExerciseWeekProgress) => {
        setSelectedExerciseForDetails(exercise);
        setExerciseDetailsOpen(true);
    };

    // Empty state when no active session
    if (!state.isSessionActive) {
        return <EmptyState onNavigateHome={() => state.navigate('/')} />;
    }

    // View All Exercises overlay
    if (state.allExercisesOpen) {
        return (
            <AllExercisesView
                sessionExercises={state.sessionExercises}
                currentExerciseIndex={state.currentExerciseIndex}
                supersetEnabled={state.supersetEnabled}
                supersetExerciseIds={state.supersetExerciseIds}
                activePlanId={state.activePlanId}
                planWorkoutId={state.planWorkoutId}
                weekProgressData={state.weekProgressData}
                setCurrentExerciseAction={state.setCurrentExerciseAction}
                updateSessionExercises={state.updateSessionExercises}
                setSupersetEnabled={state.setSupersetEnabled}
                setSupersetExerciseIds={state.setSupersetExerciseIds}
                setAllExercisesOpen={state.setAllExercisesOpen}
            />
        );
    }

    const isExerciseComplete = state.currentExercise ? state.currentExercise.setsCompleted >= state.currentExercise.targetSets : false;
    const supersetComplete =
        state.supersetEnabled &&
        handlers.supersetExercises.length === 2 &&
        handlers.supersetExercises.every((ex) => ex.setsCompleted >= ex.targetSets);
    const isIdle = !state.isRestTimerRunning && !state.isInSet;

    return (
        <>
        {/* Breathing animation for READY state anticipation */}
        <style>{`
            @keyframes breathe {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.015); }
            }
        `}</style>
        <div className="flex flex-col min-h-[calc(100dvh-8rem)] pt-0 bg-transparent transition-colors duration-200">
            <ContextBar
                planWorkoutName={state.planWorkoutName}
                duration={state.duration}
                completedSets={state.completedSets}
                totalSets={state.totalSets}
                isInSet={state.isInSet}
                isIdle={isIdle}
                planWorkoutId={state.planWorkoutId}
                supersetEnabled={state.supersetEnabled}
                sessionExercisesCount={state.sessionExercises.length}
                onOpenSaveDialog={handlers.openSaveDialog}
                onOpenSupersetDialog={handlers.openSupersetDialog}
                onOpenEndDialog={() => state.setEndDialogOpen(true)}
                onOpenAllExercises={() => state.setAllExercisesOpen(true)}
                onOpenRestDialog={handlers.openRestDialog}
                onDisableSuperset={handlers.handleDisableSuperset}
                onOpenWarmupDialog={() => state.setWarmupDialogOpen(true)}
            />

            {/* Tabs for Active / Exercises */}
            <Tabs value={state.activeTab} onValueChange={(v) => state.setActiveTab(v as ActiveWorkoutTab)} className="w-full px-4 mt-2">
                <TabsList className="bg-muted p-1 rounded-xl flex-1 w-full">
                    <TabsTrigger value="active" className="flex-1 rounded-lg text-sm font-medium">
                        Active
                    </TabsTrigger>
                    <TabsTrigger value="exercises" className="flex-1 rounded-lg text-sm font-medium">
                        Exercises
                    </TabsTrigger>
                </TabsList>

                {/* Active Tab Content */}
                <TabsContent value="active" className="mt-4">
                    {state.isWorkoutComplete ? (
                        <WorkoutCompleteCard
                            completedSets={state.completedSets}
                            duration={state.duration}
                            onFinishWorkout={handlers.handleEndWorkout}
                            onRestart={() => {
                                state.updateSessionExercises(
                                    state.sessionExercises.map((ex) => ({ ...ex, setsCompleted: 0 }))
                                );
                                state.setCurrentExerciseAction(0);
                            }}
                        />
                    ) : (
                        <TimerZone
                            isInSet={state.isInSet}
                            isRestTimerRunning={state.isRestTimerRunning}
                            remainingSeconds={state.remainingSeconds}
                            restTimerProgress={state.restTimerProgress}
                            onStartRestTimer={state.startRestTimer}
                            onCancelRestTimer={state.cancelRestTimer}
                        />
                    )}

                    {state.currentExercise && !state.isWorkoutComplete && (
                        <WorkoutCardContainer
                            currentExercise={state.currentExercise}
                            currentExerciseIndex={state.currentExerciseIndex}
                            sessionExercisesLength={state.sessionExercises.length}
                            isInSet={state.isInSet}
                            isRestTimerRunning={state.isRestTimerRunning}
                            isExerciseComplete={isExerciseComplete}
                            supersetEnabled={state.supersetEnabled}
                            supersetExercises={handlers.supersetExercises}
                            supersetComplete={supersetComplete}
                            onPreviousExercise={() => state.setCurrentExerciseAction(state.currentExerciseIndex - 1)}
                            onNextExercise={() => state.setCurrentExerciseAction(state.currentExerciseIndex + 1)}
                            onStartSet={handlers.handleStartSet}
                            onCompleteSet={handlers.handleCompleteSet}
                            onAddSet={handlers.handleAddSet}
                            onRemoveSet={handlers.handleRemoveSet}
                            onOpenSupersetDialog={handlers.openSupersetDialog}
                        />
                    )}
                </TabsContent>

                {/* Exercises Tab Content */}
                <TabsContent value="exercises" className="mt-4 pb-20">
                    <ExercisesTabContent
                        sessionExercises={state.sessionExercises}
                        onAddSet={handlers.handleExercisesTabAddSet}
                        onRemoveSet={handlers.handleExercisesTabRemoveSet}
                        onCompleteAll={handlers.handleExercisesTabCompleteAll}
                        onOpenDetails={handleOpenExerciseDetails}
                        isInSet={state.isInSet}
                        isRestTimerRunning={state.isRestTimerRunning}
                        remainingSeconds={state.remainingSeconds}
                        restTimerProgress={state.restTimerProgress}
                        onStartRestTimer={state.startRestTimer}
                        onCancelRestTimer={state.cancelRestTimer}
                    />
                </TabsContent>
            </Tabs>

            {/* Exercise Details Sheet */}
            <ExerciseDetails
                exercise={selectedExerciseForDetails?.exerciseDef || null}
                open={exerciseDetailsOpen}
                onOpenChange={setExerciseDetailsOpen}
                sets={selectedExerciseForDetails?.targetSets}
                reps={selectedExerciseForDetails?.planExercise.reps}
                weight={selectedExerciseForDetails?.planExercise.weight}
                durationSeconds={selectedExerciseForDetails?.planExercise.durationSeconds}
                comments={selectedExerciseForDetails?.planExercise.comments}
                planId={state.activePlanId || undefined}
                weekNumber={state.currentWeek}
            />

            {/* Dialogs */}
            <SaveWorkoutDialog
                open={state.saveDialogOpen}
                onOpenChange={state.setSaveDialogOpen}
                workoutName={state.workoutName}
                onWorkoutNameChange={state.setWorkoutName}
                sessionExercises={state.sessionExercises}
                onSave={handlers.handleSaveWorkout}
                isSaving={state.createPlanWorkoutMutation.isPending}
            />

            <RestManagementDialog
                open={state.restDialogOpen}
                onOpenChange={state.setRestDialogOpen}
                restTimerDuration={state.restTimerDuration}
                customRest={state.customRest}
                onCustomRestChange={state.setCustomRest}
                restError={state.restError}
                onSelectRest={handlers.handleSelectRest}
                onSaveCustomRest={handlers.handleSaveCustomRest}
            />

            <SupersetSelectionDialog
                open={state.supersetDialogOpen}
                onOpenChange={state.setSupersetDialogOpen}
                sessionExercises={state.sessionExercises}
                supersetSelection={state.supersetSelection}
                onToggleSelection={handlers.toggleSupersetSelection}
                supersetError={state.supersetError}
                onSave={handlers.handleSaveSuperset}
            />

            <EndWorkoutConfirmation
                open={state.endDialogOpen}
                onOpenChange={state.setEndDialogOpen}
                planWorkoutId={state.planWorkoutId}
                onConfirm={handlers.handleEndWorkout}
            />

            <WarmupDialog
                open={state.warmupDialogOpen}
                onOpenChange={state.setWarmupDialogOpen}
                warmup={state.generatedWarmup}
                cost={state.warmupCost}
                isLoading={state.isGeneratingWarmup}
                selectedModelId={state.warmupModelId}
                onModelChange={state.setWarmupModelId}
                onGenerate={handlers.handleGenerateWarmup}
                onRegenerate={handlers.handleGenerateWarmup}
            />
        </div>
        </>
    );
}
