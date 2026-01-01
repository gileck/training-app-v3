/**
 * Exercise Resolver Component
 * 
 * Allows users to resolve unmatched exercises by:
 * 1. Selecting from suggested matches
 * 2. Creating as custom exercise
 */

import { useState } from 'react';
import { Button } from '@/client/components/ui/button';
import { Badge } from '@/client/components/ui/badge';
import { Label } from '@/client/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/client/components/ui/dialog';
import { Check, Plus, HelpCircle, Circle, CheckCircle2 } from 'lucide-react';
import type { DraftExercise, SuggestedMatch } from '@/apis/training-plans/types';

interface ExerciseResolverProps {
    exercise: DraftExercise;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onResolve: (exerciseKey: string, resolution: ExerciseResolution) => void;
}

export interface ExerciseResolution {
    matchStatus: 'matched' | 'custom';
    matchedExerciseDefId?: string;
    matchedExerciseName?: string;
}

export function ExerciseResolver({
    exercise,
    open,
    onOpenChange,
    onResolve,
}: ExerciseResolverProps) {
    const suggestions = exercise.suggestedMatches || [];
    
    // Selected option: suggestion exerciseDefId or 'custom'
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [selectedOption, setSelectedOption] = useState<string | null>(() => {
        // Default to top suggestion if score > 70
        if (suggestions.length > 0 && suggestions[0].score >= 70) {
            return suggestions[0].exerciseDefId;
        }
        return null;
    });
    
    const handleConfirm = () => {
        if (!selectedOption) return;
        
        if (selectedOption === 'custom') {
            onResolve(exercise.draftExerciseKey, {
                matchStatus: 'custom',
            });
        } else {
            const match = suggestions.find(s => s.exerciseDefId === selectedOption);
            if (match) {
                onResolve(exercise.draftExerciseKey, {
                    matchStatus: 'matched',
                    matchedExerciseDefId: match.exerciseDefId,
                    matchedExerciseName: match.name,
                });
            }
        }
        
        onOpenChange(false);
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-2xl max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <HelpCircle className="h-5 w-5 text-orange-600 dark:text-warning" />
                        Match Exercise
                    </DialogTitle>
                    <DialogDescription>
                        Select the best match for &quot;{exercise.name}&quot; or create it as a new custom exercise.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="py-4 space-y-4">
                    {/* Suggested matches */}
                    {suggestions.length > 0 && (
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                                Suggested Matches
                            </Label>
                            {suggestions.map((suggestion) => (
                                <SuggestionOption
                                    key={suggestion.exerciseDefId}
                                    suggestion={suggestion}
                                    isSelected={selectedOption === suggestion.exerciseDefId}
                                    onSelect={() => setSelectedOption(suggestion.exerciseDefId)}
                                />
                            ))}
                        </div>
                    )}
                    
                    {/* Create custom option */}
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                            Or Create New
                        </Label>
                        <button
                            type="button"
                            className={`w-full flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors text-left ${
                                selectedOption === 'custom'
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-muted-foreground/50'
                            }`}
                            onClick={() => setSelectedOption('custom')}
                        >
                            <div className="shrink-0">
                                {selectedOption === 'custom' ? (
                                    <CheckCircle2 className="h-4 w-4 text-primary" />
                                ) : (
                                    <Circle className="h-4 w-4 text-muted-foreground" />
                                )}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <Plus className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">Create as custom exercise</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    &quot;{exercise.name}&quot; will be added to your exercise library
                                </p>
                            </div>
                        </button>
                    </div>
                </div>
                
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="rounded-lg"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!selectedOption}
                        className="rounded-lg"
                    >
                        <Check className="h-4 w-4 mr-2" />
                        Confirm
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface SuggestionOptionProps {
    suggestion: SuggestedMatch;
    isSelected: boolean;
    onSelect: () => void;
}

function SuggestionOption({ suggestion, isSelected, onSelect }: SuggestionOptionProps) {
    // Score badge color based on match quality
    const getScoreBadgeVariant = (score: number): 'default' | 'secondary' | 'outline' => {
        if (score >= 80) return 'default';
        if (score >= 60) return 'secondary';
        return 'outline';
    };
    
    return (
        <button
            type="button"
            className={`w-full flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors text-left ${
                isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50'
            }`}
            onClick={onSelect}
        >
            <div className="shrink-0">
                {isSelected ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{suggestion.name}</span>
                    <Badge 
                        variant={getScoreBadgeVariant(suggestion.score)} 
                        className="text-xs shrink-0"
                    >
                        {suggestion.score}%
                    </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                    {suggestion.primaryMuscle}
                </p>
            </div>
        </button>
    );
}
