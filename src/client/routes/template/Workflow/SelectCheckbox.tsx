/**
 * SelectCheckbox
 *
 * Checkbox indicator for bulk selection mode on workflow cards.
 */

import { Check } from 'lucide-react';

export function SelectCheckbox({ selected }: { selected: boolean }) {
    return (
        <div className="flex items-center pt-0.5 shrink-0">
            <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    selected ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                }`}
            >
                {selected && <Check className="w-3 h-3 text-primary-foreground" />}
            </div>
        </div>
    );
}
