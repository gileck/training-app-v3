import { useState } from 'react';
import { Card, CardContent } from '@/client/components/ui/card';
import { Skeleton } from '@/client/components/ui/skeleton';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/client/components/ui/dialog';
import { Battery, Info } from 'lucide-react';
import { useRecoveryScore } from '../hooks';
import type { DailyLoad } from '../utils/recoveryScore';

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today.toISOString().split('T')[0]) {
        return 'Today';
    }
    if (dateStr === yesterday.toISOString().split('T')[0]) {
        return 'Yesterday';
    }

    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getScoreBgColor(score: number): string {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-emerald-500';
    if (score >= 40) return 'bg-yellow-500';
    if (score >= 20) return 'bg-orange-500';
    return 'bg-red-500';
}

function LoadBar({ load }: { load: DailyLoad }) {
    const barWidth = Math.min(load.loadPercent, 150);
    const isOverload = load.loadPercent > 100;

    return (
        <div className="flex items-center gap-2 text-sm">
            <span className="w-20 text-muted-foreground text-xs truncate">
                {formatDate(load.date)}
            </span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all ${
                        isOverload ? 'bg-red-500' : 'bg-primary'
                    }`}
                    style={{ width: `${Math.min(barWidth, 100)}%` }}
                />
            </div>
            <span className="w-12 text-right text-xs text-muted-foreground">
                {load.sets} sets
            </span>
        </div>
    );
}

function RecoveryScoreDialog({
    open,
    onOpenChange,
    score,
    label,
    color,
    baseline,
    dailyLoads,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    score: number;
    label: string;
    color: string;
    baseline: number;
    dailyLoads: DailyLoad[];
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Battery className="h-5 w-5" />
                        Recovery Score
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Score display */}
                    <div className="text-center py-4">
                        <div className={`text-5xl font-bold ${color}`}>{score}</div>
                        <div className={`text-lg ${color}`}>{label}</div>
                    </div>

                    {/* Explanation */}
                    <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                        <div className="flex gap-2">
                            <Info className="h-4 w-4 mt-0.5 shrink-0" />
                            <p>
                                Based on your training volume over the last 10 days.
                                Recent days are weighted more heavily.
                                Your baseline is <strong>{baseline} sets/day</strong> (75th percentile).
                            </p>
                        </div>
                    </div>

                    {/* Daily breakdown */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">Last 10 Days</h4>
                        <div className="space-y-1.5">
                            {dailyLoads.map((load) => (
                                <LoadBar key={load.date} load={load} />
                            ))}
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
                        <span>0 sets</span>
                        <span>{baseline} sets (100%)</span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function RecoveryScore() {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog open/close state
    const [dialogOpen, setDialogOpen] = useState(false);
    const { data, isLoading } = useRecoveryScore();

    if (isLoading || !data) {
        return (
            <Card className="rounded-xl">
                <CardContent className="p-4 text-center">
                    <Skeleton className="h-9 w-12 mx-auto mb-1" />
                    <Skeleton className="h-4 w-16 mx-auto" />
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card
                className="rounded-xl cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setDialogOpen(true)}
            >
                <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-0.5">
                        <div
                            className={`w-2.5 h-2.5 rounded-full ${getScoreBgColor(data.score)}`}
                        />
                        <p className={`text-3xl font-bold ${data.color}`}>{data.score}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">Recovery</p>
                </CardContent>
            </Card>

            <RecoveryScoreDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                score={data.score}
                label={data.label}
                color={data.color}
                baseline={data.baseline}
                dailyLoads={data.dailyLoads}
            />
        </>
    );
}
