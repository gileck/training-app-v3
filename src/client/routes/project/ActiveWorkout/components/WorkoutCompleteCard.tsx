import { Button } from '@/client/components/template/ui/button';
import { Trophy, Flame } from 'lucide-react';

interface WorkoutCompleteCardProps {
    completedSets: number;
    duration: string;
    onFinishWorkout: () => void;
    onRestart: () => void;
}

export function WorkoutCompleteCard({
    completedSets,
    duration,
    onFinishWorkout,
    onRestart,
}: WorkoutCompleteCardProps) {
    return (
        <div className="flex flex-col items-center justify-center py-6">
            <div className="relative">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-warning via-warning/70 to-warning rounded-full blur-xl opacity-25 animate-pulse" />
                {/* Trophy icon */}
                <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-warning to-warning/70 flex items-center justify-center shadow-lg">
                    <Trophy className="h-12 w-12 text-warning-foreground" />
                </div>
            </div>
            <h2 className="text-xl font-bold mt-4 bg-gradient-to-r from-warning to-warning/70 bg-clip-text text-transparent">
                Workout Complete!
            </h2>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-warning" />
                {completedSets} sets · {duration}
            </p>
            <Button
                onClick={onFinishWorkout}
                className="mt-4 h-11 px-6 rounded-full bg-warning hover:bg-warning/90 text-warning-foreground font-semibold shadow-md"
            >
                Finish Workout
            </Button>
            <button
                onClick={onRestart}
                className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
                Restart
            </button>
        </div>
    );
}
