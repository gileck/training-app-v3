import { Button } from '@/client/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/client/components/ui/dropdown-menu';
import {
    MoreHorizontal,
    Bookmark,
    List,
    Square,
    Timer,
    PanelsLeftRight,
} from 'lucide-react';

interface ContextBarProps {
    planWorkoutName: string | null;
    duration: string;
    completedSets: number;
    totalSets: number;
    isInSet: boolean;
    isIdle: boolean;
    planWorkoutId: string | null;
    supersetEnabled: boolean;
    sessionExercisesCount: number;
    onOpenSaveDialog: () => void;
    onOpenSupersetDialog: () => void;
    onOpenEndDialog: () => void;
    onOpenAllExercises: () => void;
    onOpenRestDialog: () => void;
    onDisableSuperset: () => void;
}

export function ContextBar({
    planWorkoutName,
    duration,
    completedSets,
    totalSets,
    isInSet,
    isIdle,
    planWorkoutId,
    supersetEnabled,
    sessionExercisesCount,
    onOpenSaveDialog,
    onOpenSupersetDialog,
    onOpenEndDialog,
    onOpenAllExercises,
    onOpenRestDialog,
    onDisableSuperset,
}: ContextBarProps) {
    return (
        <div className="flex items-center justify-between py-1 px-4 max-h-14 gap-3">
            {/* Stacked layout: name on top, time + progress below - IN SET demoted to historical context */}
            <div className={`flex flex-col gap-1 min-w-0 transition-opacity duration-200 ${
                isInSet ? 'opacity-60' : isIdle ? 'opacity-70' : 'opacity-80'
            }`}>
                {planWorkoutName ? (
                    <p className="text-[18px] font-semibold text-foreground/85 truncate">
                        {planWorkoutName}
                    </p>
                ) : null}
                <p className="text-[14px] font-normal text-foreground/60 flex items-center">
                    <span>{duration}</span>
                    <span className="mx-2 text-foreground/25">·</span>
                    <span>{completedSets}/{totalSets} sets</span>
                </p>
            </div>
            <div className="flex items-center gap-2">
                {/* Show Save button only when session is not tied to a saved plan-workout */}
                {planWorkoutId === null && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onOpenSaveDialog}
                        aria-label="Save workout"
                        className="h-10 w-10 rounded-full text-primary hover:bg-primary/10 active:scale-[0.97] transition-transform"
                    >
                        <Bookmark className="h-[18px] w-[18px]" />
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onOpenSupersetDialog}
                    aria-label={supersetEnabled ? 'Edit super set' : 'Enable super set'}
                    disabled={sessionExercisesCount < 2}
                    className={`h-10 w-10 rounded-full hover:bg-primary/10 active:scale-[0.97] transition-transform ${
                        supersetEnabled ? 'text-primary' : 'text-foreground/60'
                    }`}
                >
                    <PanelsLeftRight className="h-[18px] w-[18px]" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onOpenEndDialog}
                    aria-label="End workout"
                    className="h-10 w-10 rounded-full text-destructive hover:bg-destructive/10 active:scale-[0.97] transition-transform"
                >
                    <Square className="h-[18px] w-[18px]" />
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10 flex-shrink-0 rounded-full active:scale-[0.97] transition-transform">
                            <MoreHorizontal className="h-[18px] w-[18px] text-foreground/55" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {planWorkoutId === null && (
                            <DropdownMenuItem onClick={onOpenSaveDialog}>
                                <Bookmark className="mr-2 h-4 w-4" />
                                Save workout
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={onOpenAllExercises}>
                            <List className="mr-2 h-4 w-4" />
                            View all exercises
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onOpenRestDialog}>
                            <Timer className="mr-2 h-4 w-4" />
                            Manage rest time
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onOpenSupersetDialog}>
                            <PanelsLeftRight className="mr-2 h-4 w-4" />
                            {supersetEnabled ? 'Edit super set' : 'Enable super set'}
                        </DropdownMenuItem>
                        {supersetEnabled && (
                            <DropdownMenuItem onClick={onDisableSuperset}>
                                <Square className="mr-2 h-4 w-4" />
                                Disable super set
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={onOpenEndDialog}
                            className="text-destructive focus:text-destructive"
                        >
                            <Square className="mr-2 h-4 w-4" />
                            End workout
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
