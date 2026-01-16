import {
    AllExercisesView,
    EmptyState,
    ContextBar,
    TimerZone,
    WorkoutCompleteCard,
    WorkoutCardContainer,
} from './components';
import {
    SaveWorkoutDialog,
    RestManagementDialog,
    SupersetSelectionDialog,
    EndWorkoutConfirmation,
} from './dialogs';
import { useActiveWorkoutState, useWorkoutHandlers } from './hooks';

export function ActiveWorkout() {
    const state = useActiveWorkoutState();
    const handlers = useWorkoutHandlers(state);

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
            />

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
        </div>
        </>
    );
}
