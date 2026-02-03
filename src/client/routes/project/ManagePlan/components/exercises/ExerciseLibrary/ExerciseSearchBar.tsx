/**
 * Exercise Search Bar
 */

import { Input } from '@/client/components/ui/input';
import { Search, X } from 'lucide-react';

interface ExerciseSearchBarProps {
    value: string;
    onChange: (value: string) => void;
}

export function ExerciseSearchBar({ value, onChange }: ExerciseSearchBarProps) {
    return (
        <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                placeholder="Search exercises..."
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="pl-10 pr-9 rounded-xl h-10"
            />
            {value && (
                <button
                    onClick={() => onChange('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center transition-colors"
                    aria-label="Clear search"
                >
                    <X className="h-3 w-3 text-muted-foreground" />
                </button>
            )}
        </div>
    );
}
