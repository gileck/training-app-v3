/**
 * ViewTabs
 *
 * Primary 3-way layout toggle: List | Board | Activity.
 */

import { List, LayoutGrid, Activity } from 'lucide-react';
import type { LayoutMode } from './store';

const LAYOUT_OPTIONS: { value: LayoutMode; label: string; Icon: typeof List }[] = [
    { value: 'list', label: 'List', Icon: List },
    { value: 'board', label: 'Board', Icon: LayoutGrid },
    { value: 'activity', label: 'Activity', Icon: Activity },
];

export function ViewTabs({ active, onChange }: { active: LayoutMode; onChange: (v: LayoutMode) => void }) {
    return (
        <div className="flex rounded-lg bg-muted p-0.5">
            {LAYOUT_OPTIONS.map(({ value, label, Icon }) => (
                <button
                    key={value}
                    onClick={() => onChange(value)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        active === value
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                </button>
            ))}
        </div>
    );
}
