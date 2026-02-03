import { useState, useEffect, useRef } from 'react';
import { Pencil } from 'lucide-react';
import { Input } from '@/client/components/ui/input';

interface WorkoutNameEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export function WorkoutNameEditor({ value, onChange, placeholder }: WorkoutNameEditorProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral edit mode
    const [isEditing, setIsEditing] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
    const [editValue, setEditValue] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync editValue with value prop when it changes externally
    useEffect(() => {
        setEditValue(value);
    }, [value]);

    // Focus and select text when edit mode activates
    useEffect(() => {
        if (isEditing && inputRef.current) {
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 100);
        }
    }, [isEditing]);

    const handleSave = () => {
        onChange(editValue.trim());
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditValue(value);
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <Input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') handleCancel();
                }}
                placeholder={placeholder}
                className="h-12 rounded-xl border-2 text-base font-medium placeholder:text-muted-foreground/50 focus:border-primary transition-colors"
            />
        );
    }

    return (
        <div className="flex items-center gap-2 h-12 px-4 rounded-xl border-2 border-muted bg-muted/30">
            <span className="flex-1 text-base font-medium">
                {value || <span className="text-muted-foreground/50">{placeholder}</span>}
            </span>
            <button
                onClick={() => setIsEditing(true)}
                className="p-1 rounded hover:bg-background transition-colors"
                type="button"
            >
                <Pencil className="h-4 w-4 text-muted-foreground" />
            </button>
        </div>
    );
}
