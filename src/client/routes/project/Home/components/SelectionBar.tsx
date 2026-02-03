import { Button } from '@/client/components/ui/button';
import { X, Zap } from 'lucide-react';

interface SelectionBarProps {
    selectedCount: number;
    onClearSelection: () => void;
    onStartWorkout: () => void;
    isMobile: boolean;
    isWorkoutActive: boolean;
}

export function SelectionBar({
    selectedCount,
    onClearSelection,
    onStartWorkout,
    isMobile,
    isWorkoutActive,
}: SelectionBarProps) {
    return (
        <div
            className="fixed left-0 right-0 p-4 bg-card/95 backdrop-blur-lg border-t z-50"
            style={{
                // On mobile, position above the BottomNavBar which includes safe-area-inset-bottom
                // BottomNavBar height: pt-1 (4px) + h-14 (56px) + paddingBottom (safe-area + 4px) = 64px + safe-area
                // When FloatingWorkoutBar is active, add ~70px more to avoid overlap
                // On desktop (≥640px), bottom nav is hidden, so use bottom: 0 (or 70px if workout active)
                bottom: isMobile
                    ? isWorkoutActive
                        ? 'calc(134px + env(safe-area-inset-bottom, 0px))'
                        : 'calc(64px + env(safe-area-inset-bottom, 0px))'
                    : isWorkoutActive
                      ? '70px'
                      : 0,
            }}
        >
            <div className="flex items-center gap-3 max-w-lg mx-auto">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClearSelection}
                    className="h-10 w-10 rounded-full"
                >
                    <X className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <p className="text-sm font-medium">
                        {selectedCount} exercise{selectedCount !== 1 ? 's' : ''} selected
                    </p>
                </div>
                <Button
                    onClick={onStartWorkout}
                    className="h-12 px-6 rounded-xl bg-success text-success-foreground shadow-lg shadow-success/30"
                >
                    <Zap className="mr-2 h-5 w-5" />
                    Start Workout
                </Button>
            </div>
        </div>
    );
}
