import { Card, CardContent } from '@/client/components/template/ui/card';
import { Button } from '@/client/components/template/ui/button';
import { ChevronLeft, ChevronRight, Settings2 } from 'lucide-react';
import type { TrainingPlanClient } from '@/server/database/collections/project/trainingPlans/types';

interface WeekNavigatorProps {
    currentWeek: number;
    activePlan: TrainingPlanClient;
    onPrevWeek: () => void;
    onNextWeek: () => void;
    onNavigateToPlan: () => void;
    progressPercent: number;
    completedSets: number;
    totalSets: number;
}

export function WeekNavigator({
    currentWeek,
    activePlan,
    onPrevWeek,
    onNextWeek,
    onNavigateToPlan,
    progressPercent,
    completedSets,
    totalSets,
}: WeekNavigatorProps) {
    const getMotivationalMessage = (percent: number) => {
        if (percent === 0) return "Let's get started! 💪";
        if (percent < 25) return 'Great start!';
        if (percent < 50) return 'Keep pushing!';
        if (percent < 75) return 'Halfway there! 🔥';
        if (percent < 100) return 'Almost done!';
        return 'Week complete! 🏆';
    };

    return (
        <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
            <CardContent className="relative p-4 space-y-4">
                {/* Week Navigation */}
                <div className="flex items-center justify-between">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onPrevWeek}
                        disabled={currentWeek <= 1}
                        className="h-10 w-10 rounded-full"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="text-center">
                        <p className="text-xl font-bold tracking-tight">
                            WEEK {currentWeek} / {activePlan.durationWeeks}
                        </p>
                        <button
                            onClick={onNavigateToPlan}
                            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mx-auto"
                        >
                            {activePlan.name}
                            <Settings2 className="h-3 w-3" />
                        </button>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onNextWeek}
                        disabled={currentWeek >= activePlan.durationWeeks}
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
                                    ? 'bg-success'
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
    );
}
