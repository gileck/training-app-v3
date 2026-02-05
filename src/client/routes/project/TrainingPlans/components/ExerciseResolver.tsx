/**
 * Exercise Resolver Component
 * 
 * Allows users to resolve unmatched exercises by:
 * 1. Selecting from suggested matches
 * 2. Searching the full exercise library
 * 3. Creating as custom exercise
 */

import { useState } from 'react';
import { Button } from '@/client/components/template/ui/button';
import { Badge } from '@/client/components/template/ui/badge';
import { Input } from '@/client/components/template/ui/input';
import { Label } from '@/client/components/template/ui/label';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/client/components/template/ui/dialog';
import { Check, Plus, HelpCircle, Circle, CheckCircle2, Search, ArrowLeft, Dumbbell } from 'lucide-react';
import type { DraftExercise, SuggestedMatch } from '@/apis/project/training-plans/types';
import type { ExerciseDefinitionClient } from '@/server/database/collections/project/exerciseDefinitions/types';

interface ExerciseResolverProps {
    exercise: DraftExercise;
    exerciseLibrary?: ExerciseDefinitionClient[];
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
    exerciseLibrary = [],
    open,
    onOpenChange,
    onResolve,
}: ExerciseResolverProps) {
    const suggestions = exercise.suggestedMatches || [];
    
    // View mode: 'suggestions' or 'search'
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [viewMode, setViewMode] = useState<'suggestions' | 'search'>('suggestions');
    
    // Search query for library browser
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral search state
    const [searchQuery, setSearchQuery] = useState('');
    
    // Selected option: suggestion exerciseDefId or 'custom' or library exercise id
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [selectedOption, setSelectedOption] = useState<string | null>(() => {
        // Default to top suggestion if score > 70
        if (suggestions.length > 0 && suggestions[0].score >= 70) {
            return suggestions[0].exerciseDefId;
        }
        return null;
    });
    
    // Selected library exercise (when in search mode)
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral selection state
    const [selectedLibraryExercise, setSelectedLibraryExercise] = useState<ExerciseDefinitionClient | null>(null);
    
    // Filter library by search query
    const filteredLibrary = exerciseLibrary.filter((ex) => {
        if (!searchQuery) return true;
        const searchWords = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
        const exerciseName = ex.name.toLowerCase();
        return searchWords.every((word) => exerciseName.includes(word));
    }).slice(0, 50); // Limit to 50 results
    
    const handleConfirm = () => {
        // If in search mode and an exercise is selected from library
        if (viewMode === 'search' && selectedLibraryExercise) {
            onResolve(exercise.draftExerciseKey, {
                matchStatus: 'matched',
                matchedExerciseDefId: selectedLibraryExercise._id,
                matchedExerciseName: selectedLibraryExercise.name,
            });
            onOpenChange(false);
            return;
        }
        
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
    
    const handleBackToSuggestions = () => {
        setViewMode('suggestions');
        setSearchQuery('');
        setSelectedLibraryExercise(null);
    };
    
    const handleSelectLibraryExercise = (ex: ExerciseDefinitionClient) => {
        setSelectedLibraryExercise(ex);
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {viewMode === 'search' && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 -ml-2"
                                onClick={handleBackToSuggestions}
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        )}
                        <HelpCircle className="h-5 w-5 text-warning" />
                        {viewMode === 'suggestions' ? 'Match Exercise' : 'Search Exercise'}
                    </DialogTitle>
                    <DialogDescription>
                        {viewMode === 'suggestions' 
                            ? `Select the best match for "${exercise.name}" or create it as a new custom exercise.`
                            : `Search and select any exercise from your library for "${exercise.name}".`
                        }
                    </DialogDescription>
                </DialogHeader>
                
                {viewMode === 'suggestions' ? (
                    /* Suggestions View */
                    <div className="py-4 space-y-4 overflow-y-auto">
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
                        
                        {/* Search library button */}
                        {exerciseLibrary.length > 0 && (
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                                    Or Search Library
                                </Label>
                                <Button
                                    variant="outline"
                                    className="w-full justify-start"
                                    onClick={() => {
                                        setSearchQuery(exercise.name); // Pre-fill with exercise name
                                        setViewMode('search');
                                    }}
                                >
                                    <Search className="h-4 w-4 mr-2" />
                                    Search all exercises...
                                </Button>
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
                ) : (
                    /* Search View */
                    <div className="flex-1 flex flex-col min-h-0">
                        {/* Search input */}
                        <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search exercises..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                                autoFocus
                            />
                        </div>
                        
                        {/* Exercise list */}
                        <div className="flex-1 overflow-y-auto -mx-6 px-6 max-h-[300px]">
                            <div className="space-y-2 pb-4">
                                {filteredLibrary.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Dumbbell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                        <p>No exercises found</p>
                                    </div>
                                ) : (
                                    filteredLibrary.map((ex) => (
                                        <button
                                            key={ex._id}
                                            type="button"
                                            className={`w-full flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors text-left ${
                                                selectedLibraryExercise?._id === ex._id
                                                    ? 'border-primary bg-primary/5'
                                                    : 'border-border hover:border-muted-foreground/50'
                                            }`}
                                            onClick={() => handleSelectLibraryExercise(ex)}
                                        >
                                            <div className="shrink-0">
                                                {selectedLibraryExercise?._id === ex._id ? (
                                                    <CheckCircle2 className="h-4 w-4 text-primary" />
                                                ) : (
                                                    <Circle className="h-4 w-4 text-muted-foreground" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-medium truncate">{ex.name}</span>
                                                    {!ex.isSystem && (
                                                        <Badge 
                                                            variant="outline" 
                                                            className="text-xs shrink-0 bg-warning/10 text-warning border-warning/30"
                                                        >
                                                            Custom
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    {ex.primaryMuscle}
                                                </p>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
                
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={viewMode === 'suggestions' ? !selectedOption : !selectedLibraryExercise}
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
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{suggestion.name}</span>
                    <Badge 
                        variant={getScoreBadgeVariant(suggestion.score)} 
                        className="text-xs shrink-0"
                    >
                        {suggestion.score}%
                    </Badge>
                    {!suggestion.isSystem && (
                        <Badge 
                            variant="outline" 
                            className="text-xs shrink-0 bg-warning/10 text-warning border-warning/30"
                        >
                            Custom
                        </Badge>
                    )}
                </div>
                <p className="text-xs text-muted-foreground">
                    {suggestion.primaryMuscle}
                </p>
            </div>
        </button>
    );
}
