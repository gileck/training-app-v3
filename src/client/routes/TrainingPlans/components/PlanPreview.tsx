/**
 * Plan Preview Component
 * 
 * Core UI component for displaying a DraftPlan with workouts and exercises.
 * Used by all plan creation flows: AI generation, JSON import, and shared plans.
 * 
 * Features:
 * - Plan summary (name, duration, exercise/workout counts)
 * - Workout cards with exercise lists
 * - Exercise details (sets × reps @ weight)
 * - Optional match status badges (for flows that need exercise resolution)
 * - Optional exercise resolution UI (click to resolve unmatched exercises)
 * - Optional AI cost display
 * 
 * Usage:
 * - AI Flow: showMatchStatus=true, onExerciseResolved provided (user resolves exercises)
 * - Import Flow: showMatchStatus=false (via PlanPreviewCommit, autoResolveUnmatched=true)
 * - Share Flow: showMatchStatus=false (via PlanPreview directly, autoResolveUnmatched=true)
 */

import { useState } from 'react';
import { Badge } from '@/client/components/ui/badge';
import { Button } from '@/client/components/ui/button';
import { Card, CardContent } from '@/client/components/ui/card';
import { Dumbbell, Calendar, AlertCircle, CheckCircle2, HelpCircle, Plus } from 'lucide-react';
import type { DraftPlan, DraftExercise, DraftWorkout } from '@/apis/training-plans/types';
import { ExerciseResolver, type ExerciseResolution } from './ExerciseResolver';

interface PlanPreviewProps {
    /** The draft plan to display */
    preview: DraftPlan;
    /** AI cost to display (null to hide) */
    previewCost?: number | null;
    /** Callback when user resolves an exercise (only used when showMatchStatus=true) */
    onExerciseResolved?: (exerciseKey: string, resolution: ExerciseResolution) => void;
    /** Show match status badges and resolution UI (default: true) */
    showMatchStatus?: boolean;
}

export function PlanPreview({ 
    preview, 
    previewCost = null, 
    onExerciseResolved,
    showMatchStatus = true,
}: PlanPreviewProps) {
    // Track which exercise is being resolved (for the resolution dialog)
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [resolvingExercise, setResolvingExercise] = useState<DraftExercise | null>(null);
    
    // Count exercises by match status (only computed when showing match status)
    const matchedCount = showMatchStatus ? preview.exercises.filter(e => e.matchStatus === 'matched').length : 0;
    const unresolvedCount = showMatchStatus ? preview.exercises.filter(e => e.matchStatus === 'unresolved').length : 0;
    const customCount = showMatchStatus ? preview.exercises.filter(e => e.matchStatus === 'custom').length : 0;
    
    const hasUnresolved = unresolvedCount > 0;

    return (
        <div className="py-4 space-y-4">
            {/* Plan Summary Card */}
            <Card className="rounded-xl bg-muted/30">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold">{preview.planName}</h3>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {preview.durationWeeks} weeks
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-muted-foreground">
                                {preview.exercises.length} exercises
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {preview.workouts.length} workouts
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
            
            {/* Match Status Summary Badges */}
            {/* Shows counts of matched/unresolved/custom exercises for AI and Import flows */}
            {showMatchStatus && (matchedCount > 0 || unresolvedCount > 0 || customCount > 0) && (
                <div className="flex flex-wrap gap-2">
                    {matchedCount > 0 && (
                        <Badge variant="outline" className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-success" />
                            {matchedCount} matched
                        </Badge>
                    )}
                    {unresolvedCount > 0 && (
                        <Badge variant="outline" className="flex items-center gap-1 border-warning text-warning">
                            <HelpCircle className="h-3 w-3" />
                            {unresolvedCount} need resolution
                        </Badge>
                    )}
                    {customCount > 0 && (
                        <Badge variant="outline" className="flex items-center gap-1">
                            <Plus className="h-3 w-3 text-info" />
                            {customCount} custom
                        </Badge>
                    )}
                </div>
            )}

            {/* Unresolved Exercises Warning Banner */}
            {/* Prompts user to resolve exercises that couldn't be auto-matched */}
            {showMatchStatus && hasUnresolved && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 text-warning text-sm">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                        {unresolvedCount} exercise{unresolvedCount > 1 ? 's' : ''} couldn&apos;t be matched automatically.
                        Click on them to select a match or create as custom.
                    </span>
                </div>
            )}

            {/* Workouts List */}
            <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">Workouts</h4>
                {preview.workouts.map((workout: DraftWorkout, index: number) => (
                    <WorkoutCard 
                        key={index} 
                        workout={workout} 
                        exercises={preview.exercises}
                        onResolveClick={showMatchStatus ? setResolvingExercise : undefined}
                        showMatchStatus={showMatchStatus}
                    />
                ))}
            </div>

            {/* Custom Exercises Info Banner */}
            {/* Shows when exercises will be created as new custom exercises */}
            {showMatchStatus && customCount > 0 && !hasUnresolved && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-info/10 text-info text-sm">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                        {customCount} exercise{customCount > 1 ? 's' : ''} will be added to your library as custom.
                    </span>
                </div>
            )}

            {/* AI Cost Display */}
            {/* Shows the cost of AI generation (only for AI flow) */}
            {previewCost !== null && previewCost > 0 && (
                <div className="text-xs text-muted-foreground text-right">
                    AI cost: ${previewCost.toFixed(4)}
                </div>
            )}
            
            {/* Exercise Resolver Dialog */}
            {/* Opens when user clicks on an unresolved exercise */}
            {showMatchStatus && resolvingExercise && onExerciseResolved && (
                <ExerciseResolver
                    exercise={resolvingExercise}
                    open={true}
                    onOpenChange={(open) => {
                        if (!open) setResolvingExercise(null);
                    }}
                    onResolve={(key, resolution) => {
                        onExerciseResolved(key, resolution);
                        setResolvingExercise(null);
                    }}
                />
            )}
        </div>
    );
}

// ============================================================================
// Sub-components (internal to this file)
// ============================================================================

interface WorkoutCardProps {
    workout: DraftWorkout;
    exercises: DraftExercise[];
    onResolveClick?: (exercise: DraftExercise) => void;
    showMatchStatus?: boolean;
}

/**
 * Workout Card - displays a single workout with its exercises
 */
function WorkoutCard({ workout, exercises, onResolveClick, showMatchStatus = true }: WorkoutCardProps) {
    return (
        <Card className="rounded-xl">
            <CardContent className="p-3">
                <h5 className="font-medium mb-2">{workout.name}</h5>
                <div className="space-y-1">
                    {workout.items.map((item, itemIndex: number) => {
                        const exercise = exercises.find(
                            (e: DraftExercise) => e.draftExerciseKey === item.draftExerciseKey
                        );
                        if (!exercise) return null;

                        return (
                            <ExerciseRow 
                                key={itemIndex} 
                                exercise={exercise}
                                onResolveClick={onResolveClick}
                                showMatchStatus={showMatchStatus}
                            />
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

interface ExerciseRowProps {
    exercise: DraftExercise;
    onResolveClick?: (exercise: DraftExercise) => void;
    showMatchStatus?: boolean;
}

/**
 * Exercise Row - displays a single exercise with volume and optional match status
 */
function ExerciseRow({ exercise, onResolveClick, showMatchStatus = true }: ExerciseRowProps) {
    // Format volume display (e.g., "3×8" or "3×30s")
    const formatVolume = () => {
        const sets = exercise.sets || 3;
        if (exercise.reps) {
            return `${sets}×${exercise.reps}`;
        }
        if (exercise.durationSeconds) {
            return `${sets}×${exercise.durationSeconds}s`;
        }
        return `${sets}×?`;
    };
    
    // Derive match status flags (only relevant when showMatchStatus is true)
    const isUnresolved = showMatchStatus && exercise.matchStatus === 'unresolved';
    const isMatched = showMatchStatus && exercise.matchStatus === 'matched';
    const isCustom = showMatchStatus && exercise.matchStatus === 'custom';

    return (
        <div
            className={`flex items-center justify-between text-sm py-1.5 px-2 rounded transition-colors ${
                isUnresolved
                    ? 'bg-warning/10 border border-warning/30 cursor-pointer hover:bg-warning/20'
                    : 'bg-muted/30'
            }`}
            onClick={isUnresolved && onResolveClick ? () => onResolveClick(exercise) : undefined}
        >
            {/* Exercise name and match status badge */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
                <Dumbbell className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate">{exercise.name}</span>
                
                {/* Match status badges */}
                {isMatched && (
                    <Badge variant="outline" className="text-xs shrink-0 border-success/50 text-success">
                        <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                        Matched
                    </Badge>
                )}
                {isCustom && (
                    <Badge variant="outline" className="text-xs shrink-0">
                        <Plus className="h-2.5 w-2.5 mr-1" />
                        New
                    </Badge>
                )}
                {isUnresolved && onResolveClick && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs px-2 border-warning text-warning hover:bg-warning/20"
                        onClick={(e) => {
                            e.stopPropagation();
                            onResolveClick(exercise);
                        }}
                    >
                        <HelpCircle className="h-3 w-3 mr-1" />
                        Resolve
                    </Button>
                )}
            </div>
            
            {/* Volume display (sets × reps @ weight) */}
            <span className="text-muted-foreground shrink-0 ml-2">
                {formatVolume()}
                {exercise.weightKg ? ` @ ${exercise.weightKg}kg` : ''}
            </span>
        </div>
    );
}
