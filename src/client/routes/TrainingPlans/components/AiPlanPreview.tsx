/**
 * AI Plan Preview Component
 * 
 * Displays the AI-generated plan preview with workouts and exercises.
 * Shows match status badges and allows resolving unmatched exercises.
 */

import { useState } from 'react';
import { Badge } from '@/client/components/ui/badge';
import { Button } from '@/client/components/ui/button';
import { Card, CardContent } from '@/client/components/ui/card';
import { Dumbbell, Calendar, AlertCircle, CheckCircle2, HelpCircle, Plus } from 'lucide-react';
import type { DraftPlan, DraftExercise, DraftWorkout } from '@/apis/training-plans/types';
import { ExerciseResolver, type ExerciseResolution } from './ExerciseResolver';

interface AiPlanPreviewProps {
    preview: DraftPlan;
    previewCost: number | null;
    onExerciseResolved: (exerciseKey: string, resolution: ExerciseResolution) => void;
}

export function AiPlanPreview({ preview, previewCost, onExerciseResolved }: AiPlanPreviewProps) {
    // Track which exercise is being resolved
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [resolvingExercise, setResolvingExercise] = useState<DraftExercise | null>(null);
    
    // Count by status
    const matchedCount = preview.exercises.filter(e => e.matchStatus === 'matched').length;
    const unresolvedCount = preview.exercises.filter(e => e.matchStatus === 'unresolved').length;
    const customCount = preview.exercises.filter(e => e.matchStatus === 'custom').length;
    
    const hasUnresolved = unresolvedCount > 0;

    return (
        <div className="py-4 space-y-4">
            {/* Plan Summary */}
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
            
            {/* Match Status Summary */}
            <div className="flex flex-wrap gap-2">
                {matchedCount > 0 && (
                    <Badge variant="outline" className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-success" />
                        {matchedCount} matched
                    </Badge>
                )}
                {unresolvedCount > 0 && (
                    <Badge variant="outline" className="flex items-center gap-1 border-orange-500 text-orange-700 dark:border-warning dark:text-warning">
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

            {/* Unresolved Warning */}
            {hasUnresolved && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-100 text-orange-800 dark:bg-warning/10 dark:text-warning text-sm">
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
                        onResolveClick={setResolvingExercise}
                    />
                ))}
            </div>

            {/* Custom Exercises Info */}
            {customCount > 0 && !hasUnresolved && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-info/10 text-info text-sm">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                        {customCount} exercise{customCount > 1 ? 's' : ''} will be added to your library as custom.
                    </span>
                </div>
            )}

            {/* Cost Display */}
            {previewCost !== null && previewCost > 0 && (
                <div className="text-xs text-muted-foreground text-right">
                    AI cost: ${previewCost.toFixed(4)}
                </div>
            )}
            
            {/* Exercise Resolver Dialog */}
            {resolvingExercise && (
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

interface WorkoutCardProps {
    workout: DraftWorkout;
    exercises: DraftExercise[];
    onResolveClick: (exercise: DraftExercise) => void;
}

function WorkoutCard({ workout, exercises, onResolveClick }: WorkoutCardProps) {
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
    onResolveClick: (exercise: DraftExercise) => void;
}

function ExerciseRow({ exercise, onResolveClick }: ExerciseRowProps) {
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
    
    const isUnresolved = exercise.matchStatus === 'unresolved';
    const isMatched = exercise.matchStatus === 'matched';
    const isCustom = exercise.matchStatus === 'custom';

    return (
        <div 
            className={`flex items-center justify-between text-sm py-1.5 px-2 rounded transition-colors ${
                isUnresolved 
                    ? 'bg-orange-50 border border-orange-300 cursor-pointer hover:bg-orange-100 dark:bg-warning/10 dark:border-warning/30 dark:hover:bg-warning/20' 
                    : 'bg-muted/30'
            }`}
            onClick={isUnresolved ? () => onResolveClick(exercise) : undefined}
        >
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
                {isUnresolved && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs px-2 border-orange-500 text-orange-700 hover:bg-orange-100 dark:border-warning dark:text-warning dark:hover:bg-warning/20"
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
            <span className="text-muted-foreground shrink-0 ml-2">
                {formatVolume()}
                {exercise.weightKg ? ` @ ${exercise.weightKg}kg` : ''}
            </span>
        </div>
    );
}
