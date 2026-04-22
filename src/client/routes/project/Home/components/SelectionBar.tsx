import { Button } from '@/client/components/template/ui/button';
import { X, Zap, Pencil, SkipForward, Eye, RotateCcw } from 'lucide-react';

interface SelectionBarProps {
    selectedCount: number;
    onClearSelection: () => void;
    onStartWorkout: () => void;
    onEditSingle?: () => void;
    onSkipSingle?: () => void;
    onViewSingle?: () => void;
    isSingleSkipped?: boolean;
    isWorkoutActive: boolean;
}

export function SelectionBar({
    selectedCount,
    onClearSelection,
    onStartWorkout,
    onEditSingle,
    onSkipSingle,
    onViewSingle,
    isSingleSkipped,
    isWorkoutActive,
}: SelectionBarProps) {
    const isSingle = selectedCount === 1;

    return (
        <div
            className={`fixed left-4 right-4 z-50 mx-auto max-w-lg bg-card dark:bg-muted border border-border rounded-2xl shadow-2xl ring-1 ring-border/60 p-3 ${
                isWorkoutActive ? 'bottom-[150px]' : 'bottom-20'
            }`}
        >
            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClearSelection}
                    className="h-12 w-12 rounded-full shrink-0"
                    aria-label="Clear selection"
                >
                    <X className="h-5 w-5" />
                </Button>

                {isSingle ? (
                    <div className="flex items-center justify-end gap-1.5 flex-1">
                        <Button
                            variant="ghost"
                            onClick={onEditSingle}
                            className="h-14 min-w-14 px-2 rounded-xl flex-col gap-1"
                            aria-label="Edit exercise"
                        >
                            <Pencil className="h-5 w-5" />
                            <span className="text-[11px] leading-none font-medium">Edit</span>
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={onSkipSingle}
                            className={`h-14 min-w-14 px-2 rounded-xl flex-col gap-1 ${
                                isSingleSkipped ? 'text-warning' : ''
                            }`}
                            aria-label={isSingleSkipped ? 'Unskip exercise' : 'Skip exercise'}
                        >
                            {isSingleSkipped ? (
                                <RotateCcw className="h-5 w-5" />
                            ) : (
                                <SkipForward className="h-5 w-5" />
                            )}
                            <span className="text-[11px] leading-none font-medium">
                                {isSingleSkipped ? 'Unskip' : 'Skip'}
                            </span>
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={onViewSingle}
                            className="h-14 min-w-14 px-2 rounded-xl flex-col gap-1"
                            aria-label="View exercise"
                        >
                            <Eye className="h-5 w-5" />
                            <span className="text-[11px] leading-none font-medium">View</span>
                        </Button>
                        <Button
                            onClick={onStartWorkout}
                            className="h-14 px-4 ml-1 rounded-xl bg-success text-success-foreground shadow-md shadow-success/30 shrink-0 font-semibold"
                        >
                            <Zap className="mr-1.5 h-5 w-5" />
                            Start
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                                {selectedCount} exercises selected
                            </p>
                        </div>
                        <Button
                            onClick={onStartWorkout}
                            className="h-12 px-5 rounded-xl bg-success text-success-foreground shadow-md shadow-success/30 shrink-0 font-semibold"
                        >
                            <Zap className="mr-1.5 h-5 w-5" />
                            Start
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
