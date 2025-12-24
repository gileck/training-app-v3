import { Dialog, DialogContent } from '@/client/components/ui/dialog';
import { Badge } from '@/client/components/ui/badge';
import { Card, CardContent } from '@/client/components/ui/card';
import { Separator } from '@/client/components/ui/separator';
import { Skeleton } from '@/client/components/ui/skeleton';
import { Button } from '@/client/components/ui/button';
import { Dumbbell, Clock, Weight, Target, Info, MessageSquare, History, Calendar, CheckCircle2, X, Repeat, Timer } from 'lucide-react';
import type { ExerciseDefinitionClient } from '@/server/database/collections/exerciseDefinitions/types';
import { useQuery } from '@tanstack/react-query';
import { getExerciseHistory } from '@/apis/activity-logs/client';
import { useQueryDefaults } from '@/client/query';

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
}: ExerciseDetailsProps) {
    const { data: historyData, isLoading: historyLoading } = useExerciseHistory(exercise?._id, open);
    const history = historyData?.history || [];

    if (!exercise) return null;

    // Count how many stats we have
    const stats = [
        sets !== undefined && { value: sets, label: 'Sets', icon: Target },
        reps !== undefined && reps > 0 && { value: reps, label: 'Reps', icon: Repeat },
        weight !== undefined && weight > 0 && { value: `${weight}kg`, label: 'Weight', icon: Weight },
        durationSeconds !== undefined && durationSeconds > 0 && { value: `${durationSeconds}s`, label: 'Duration', icon: Timer },
    ].filter(Boolean) as { value: string | number; label: string; icon: React.ElementType }[];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100%-32px)] max-w-lg mx-auto max-h-[calc(100vh-64px)] overflow-y-auto rounded-3xl p-0 gap-0 border-0 shadow-2xl">
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
                        // eslint-disable-next-line @next/next/no-img-element
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

                    {/* Comments (if provided) */}
                    {comments && comments.trim() !== '' && (
                        <>
                            <Separator />
                            <div>
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4" />
                                    Notes
                                </h3>
                                <Card className="rounded-xl border-dashed">
                                    <CardContent className="p-4">
                                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{comments}</p>
                                    </CardContent>
                                </Card>
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
                                        <div className="flex items-center gap-1.5 text-green-600 dark:text-green-500">
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


