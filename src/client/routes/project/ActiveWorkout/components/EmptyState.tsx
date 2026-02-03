import { Button } from '@/client/components/template/ui/button';
import { Play, Dumbbell } from 'lucide-react';

interface EmptyStateProps {
    onNavigateHome: () => void;
}

export function EmptyState({ onNavigateHome }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                <Dumbbell className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Active Workout</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-xs">
                Start a workout from the home screen
            </p>
            <Button onClick={onNavigateHome} className="h-12 px-6 rounded-xl">
                <Play className="mr-2 h-5 w-5" />
                Go to Workouts
            </Button>
        </div>
    );
}
