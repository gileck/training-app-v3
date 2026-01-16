/**
 * Create Custom Exercise Banner
 */

import { Sparkles, X } from 'lucide-react';

interface CreateExerciseBannerProps {
    onCreateClick: () => void;
    onDismiss: () => void;
}

export function CreateExerciseBanner({ onCreateClick, onDismiss }: CreateExerciseBannerProps) {
    return (
        <div className="relative mb-3">
            <button
                onClick={onCreateClick}
                className="w-full p-2.5 rounded-xl border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all flex items-center gap-2.5 group"
            >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors shrink-0">
                    <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="text-left min-w-0 flex-1">
                    <p className="font-medium text-sm text-foreground">Create Custom Exercise</p>
                    <p className="text-xs text-muted-foreground truncate">Add your own exercise to the library</p>
                </div>
            </button>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDismiss();
                }}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center transition-colors"
                aria-label="Dismiss"
            >
                <X className="h-3 w-3 text-muted-foreground" />
            </button>
        </div>
    );
}
