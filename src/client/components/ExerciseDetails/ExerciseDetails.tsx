import { useState } from 'react';
import { Dialog, DialogContent } from '@/client/components/ui/dialog';
import { Badge } from '@/client/components/ui/badge';
import { Card, CardContent } from '@/client/components/ui/card';
import { Separator } from '@/client/components/ui/separator';
import { Skeleton } from '@/client/components/ui/skeleton';
import { Button } from '@/client/components/ui/button';
import { Textarea } from '@/client/components/ui/textarea';
import { Dumbbell, Clock, Weight, Target, Info, MessageSquare, History, Calendar, CheckCircle2, X, Repeat, Timer, ChevronDown, ChevronUp, Edit2, Save, Plus } from 'lucide-react';
import type { ExerciseDefinitionClient } from '@/server/database/collections/exerciseDefinitions/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getExerciseHistory } from '@/apis/activity-logs/client';
import { getExerciseNotes, updateExerciseNote } from '@/apis/weekly-progress/client';
import { useQueryDefaults } from '@/client/query';
import { toast } from '@/client/components/ui/toast';

interface ExerciseDetailsProps {
    exercise: ExerciseDefinitionClient | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    // Optional exercise configuration
    sets?: number;
    reps?: number;
    weight?: number;
    durationSeconds?: number;
    comments?: string;
    // Required for notes feature
    planId?: string;
    weekNumber?: number;
}

function useExerciseHistory(exerciseDefId: string | undefined, enabled: boolean) {
    const queryDefaults = useQueryDefaults();
    return useQuery({
        queryKey: ['exercise-history', exerciseDefId],
        queryFn: async () => {
            if (!exerciseDefId) return { history: [] };
            const result = await getExerciseHistory({ exerciseDefId, limit: 10 });
            return result.data || { history: [] };
        },
        enabled: enabled && !!exerciseDefId,
        ...queryDefaults,
    });
}

function useExerciseNotes(planId: string | undefined, exerciseDefId: string | undefined, weekNumber: number | undefined, enabled: boolean) {
    const queryDefaults = useQueryDefaults();
    return useQuery({
        queryKey: ['exercise-notes', planId, exerciseDefId, weekNumber],
        queryFn: async () => {
            if (!planId || !exerciseDefId || !weekNumber) return { currentNote: '', previousNotes: [] };
            const result = await getExerciseNotes({ planId, exerciseDefId, weekNumber });
            return result.data || { currentNote: '', previousNotes: [] };
        },
        enabled: enabled && !!planId && !!exerciseDefId && !!weekNumber,
        ...queryDefaults,
    });
}

/**
 * Hook for updating an exercise note
 * 
 * Uses OPTIMISTIC-ONLY pattern:
 * - UI updates immediately in onMutate
 * - Server response is IGNORED on success
 * - Only on ERROR do we rollback to previous state
 */
function useUpdateExerciseNote() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async (data: { planId: string; exerciseDefId: string; weekNumber: number; content: string }) => {
            const response = await updateExerciseNote(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        // OPTIMISTIC UPDATE: Update note immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables) => {
            const queryKey = ['exercise-notes', variables.planId, variables.exerciseDefId, variables.weekNumber];
            await queryClient.cancelQueries({ queryKey });
            const previous = queryClient.getQueryData(queryKey);

            queryClient.setQueryData(queryKey, (old: { currentNote?: string; previousNotes?: unknown[] } | undefined) => {
                if (!old) return { currentNote: variables.content, previousNotes: [] };
                return { ...old, currentNote: variables.content };
            });

            return { previous, queryKey };
        },
        // ONLY on error: rollback to previous state
        onError: (error, _variables, context) => {
            if (context?.previous && context?.queryKey) {
                queryClient.setQueryData(context.queryKey, context.previous);
            }
            toast.error(`Failed to save note: ${error.message}`);
        },
        // onSuccess: intentionally empty - NEVER update UI from server response
        // onSettled: intentionally empty - NEVER refetch after mutation
    });
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
}

// Stat card for configuration display
function StatCard({ value, label, icon: Icon }: { value: string | number; label: string; icon: React.ElementType }) {
    return (
        <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/10">
            <Icon className="h-5 w-5 text-primary/60 mb-2" />
            <p className="text-2xl font-bold text-primary">{value}</p>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        </div>
    );
}

export function ExerciseDetails({
    exercise,
    open,
    onOpenChange,
    sets,
    reps,
    weight,
    durationSeconds,
    comments,
    planId,
    weekNumber,
}: ExerciseDetailsProps) {
    const { data: historyData, isLoading: historyLoading } = useExerciseHistory(exercise?._id, open);
    const { data: notesData, isLoading: notesLoading } = useExerciseNotes(planId, exercise?._id, weekNumber, open);
    const updateNoteMutation = useUpdateExerciseNote();
    
    const history = historyData?.history || [];
    const currentNote = notesData?.currentNote || '';
    const previousNotes = notesData?.previousNotes || [];

    // State for editing notes
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog edit mode state
    const [isEditingNote, setIsEditingNote] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
    const [noteContent, setNoteContent] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral collapsible section state
    const [previousNotesExpanded, setPreviousNotesExpanded] = useState(false);

    // Reset state when dialog opens/closes
    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) {
            setIsEditingNote(false);
            setNoteContent('');
            setPreviousNotesExpanded(false);
        }
        onOpenChange(newOpen);
    };

    const handleStartEditNote = () => {
        setNoteContent(currentNote);
        setIsEditingNote(true);
    };

    const handleSaveNote = () => {
        if (!planId || !exercise?._id || !weekNumber) return;
        
        updateNoteMutation.mutate({
            planId,
            exerciseDefId: exercise._id,
            weekNumber,
            content: noteContent,
        }, {
            onSuccess: () => {
                setIsEditingNote(false);
                toast.success('Note saved');
            },
        });
    };

    const handleCancelEdit = () => {
        setIsEditingNote(false);
        setNoteContent('');
    };

    if (!exercise) return null;

    // Count how many stats we have
    const stats = [
        sets !== undefined && { value: sets, label: 'Sets', icon: Target },
        reps !== undefined && reps > 0 && { value: reps, label: 'Reps', icon: Repeat },
        weight !== undefined && weight > 0 && { value: `${weight}kg`, label: 'Weight', icon: Weight },
        durationSeconds !== undefined && durationSeconds > 0 && { value: `${durationSeconds}s`, label: 'Duration', icon: Timer },
    ].filter(Boolean) as { value: string | number; label: string; icon: React.ElementType }[];

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-lg max-h-[calc(100vh-64px)] overflow-y-auto p-0 gap-0">
                {/* Close button */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onOpenChange(false)}
                    className="absolute right-4 top-4 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background"
                >
                    <X className="h-4 w-4" />
                </Button>

                {/* Exercise image header */}
                <div className="relative w-full h-52 bg-gradient-to-br from-muted to-muted/50 overflow-hidden">
                    {exercise.imageUrl ? (
                        <img
                            src={exercise.imageUrl}
                            alt={exercise.name}
                            className="h-full w-full object-contain p-4"
                        />
                    ) : (
                        <div className="h-full w-full flex items-center justify-center">
                            <Dumbbell className="h-20 w-20 text-muted-foreground/50" />
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Title */}
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">{exercise.name}</h2>
                        
                        {/* Muscle badges */}
                        <div className="flex flex-wrap gap-2 mt-3">
                            <Badge className="bg-primary/10 text-primary border-primary/20 font-medium">
                                {exercise.primaryMuscle}
                            </Badge>
                            {exercise.secondaryMuscles.map((muscle) => (
                                <Badge
                                    key={muscle}
                                    variant="outline"
                                    className="bg-[hsl(210,100%,95%)] text-[hsl(210,100%,40%)] border-[hsl(210,100%,85%)] dark:bg-[hsl(210,100%,20%)] dark:text-[hsl(210,100%,80%)] dark:border-[hsl(210,100%,30%)]"
                                >
                                    {muscle}
                                </Badge>
                            ))}
                        </div>

                        {/* Exercise attributes */}
                        <div className="flex flex-wrap gap-2 mt-3">
                            {exercise.isBodyweight && (
                                <Badge variant="secondary" className="gap-1.5 text-xs">
                                    <Weight className="h-3 w-3" />
                                    Bodyweight
                                </Badge>
                            )}
                            {exercise.isStatic && (
                                <Badge variant="secondary" className="gap-1.5 text-xs">
                                    <Clock className="h-3 w-3" />
                                    Static/Timed
                                </Badge>
                            )}
                            <Badge variant="outline" className="gap-1.5 text-xs">
                                <Info className="h-3 w-3" />
                                {exercise.type}
                            </Badge>
                        </div>
                    </div>

                    {/* Current configuration (if provided) */}
                    {stats.length > 0 && (
                        <>
                            <Separator />
                            <div className={`grid gap-3 ${stats.length === 1 ? 'grid-cols-1' : stats.length === 2 ? 'grid-cols-2' : stats.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                                {stats.map((stat, i) => (
                                    <StatCard key={i} {...stat} />
                                ))}
                            </div>
                        </>
                    )}

                    {/* Comments (if provided) - these are the static exercise notes */}
                    {comments && comments.trim() !== '' && (
                        <>
                            <Separator />
                            <div>
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                                    <Info className="h-4 w-4" />
                                    Exercise Instructions
                                </h3>
                                <Card className="rounded-xl border-dashed">
                                    <CardContent className="p-4">
                                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{comments}</p>
                                    </CardContent>
                                </Card>
                            </div>
                        </>
                    )}

                    {/* Weekly Notes - per exercise per week */}
                    {planId && weekNumber && (
                        <>
                            <Separator />
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4" />
                                        Week {weekNumber} Note
                                    </h3>
                                    {!isEditingNote && !notesLoading && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleStartEditNote}
                                            className="h-8 px-3 text-xs"
                                        >
                                            {currentNote ? <Edit2 className="h-3.5 w-3.5 mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
                                            {currentNote ? 'Edit' : 'Add Note'}
                                        </Button>
                                    )}
                                </div>

                                {notesLoading ? (
                                    <Skeleton className="h-20 w-full rounded-xl" />
                                ) : isEditingNote ? (
                                    <div className="space-y-3">
                                        <Textarea
                                            value={noteContent}
                                            onChange={(e) => setNoteContent(e.target.value)}
                                            placeholder="Add a note for this exercise this week..."
                                            className="rounded-xl resize-none min-h-[100px]"
                                        />
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleCancelEdit}
                                                className="flex-1 h-9 rounded-lg"
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={handleSaveNote}
                                                disabled={updateNoteMutation.isPending}
                                                className="flex-1 h-9 rounded-lg"
                                            >
                                                <Save className="h-3.5 w-3.5 mr-1.5" />
                                                {updateNoteMutation.isPending ? 'Saving...' : 'Save'}
                                            </Button>
                                        </div>
                                    </div>
                                ) : currentNote ? (
                                    <Card className="rounded-xl bg-primary/5 border-primary/20">
                                        <CardContent className="p-4">
                                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{currentNote}</p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <div className="text-center py-4 text-muted-foreground border-2 border-dashed rounded-xl">
                                        <MessageSquare className="h-6 w-6 mx-auto mb-1 opacity-40" />
                                        <p className="text-sm">No note for this week</p>
                                    </div>
                                )}

                                {/* Previous weeks' notes (collapsed by default) */}
                                {previousNotes.length > 0 && (
                                    <div className="mt-4">
                                        <button
                                            onClick={() => setPreviousNotesExpanded(!previousNotesExpanded)}
                                            className="flex items-center justify-between w-full py-2 text-left group"
                                        >
                                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                                Previous Notes ({previousNotes.length})
                                            </span>
                                            {previousNotesExpanded ? (
                                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                            ) : (
                                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                            )}
                                        </button>
                                        
                                        {previousNotesExpanded && (
                                            <div className="space-y-2 mt-2">
                                                {previousNotes.map((note) => (
                                                    <Card key={note.weekNumber} className="rounded-xl border-dashed">
                                                        <CardContent className="p-3">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Badge variant="secondary" className="text-xs">
                                                                    Week {note.weekNumber}
                                                                </Badge>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {new Date(note.updatedAt).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground">
                                                                {note.content}
                                                            </p>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Exercise History */}
                    <Separator />
                    <div>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                            <History className="h-4 w-4" />
                            Recent History
                        </h3>
                        {historyLoading ? (
                            <div className="space-y-2">
                                <Skeleton className="h-14 w-full rounded-xl" />
                                <Skeleton className="h-14 w-full rounded-xl" />
                            </div>
                        ) : history.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground">
                                <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                <p className="text-sm">No history yet</p>
                                <p className="text-xs mt-1 opacity-70">Complete sets to see your progress</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {history.map((entry, index) => (
                                    <div 
                                        key={`${entry.date}-${entry.weekNumber}-${index}`} 
                                        className="flex items-center justify-between p-3 rounded-xl bg-muted/50"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                                                <Calendar className="h-4 w-4 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">{formatDate(entry.date)}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {entry.planName} • Week {entry.weekNumber}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-success">
                                            <CheckCircle2 className="h-4 w-4" />
                                            <span className="font-semibold text-sm">{entry.setsCompleted}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* System/Custom indicator */}
                    <div className="text-xs text-muted-foreground/60 text-center pt-2 pb-2">
                        {exercise.isSystem ? 'System Exercise' : 'Custom Exercise'}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}


