/**
 * Editable Field Component
 * Mobile-friendly edit field using bottom sheet
 */

import { useState, useEffect, useRef, ReactNode } from 'react';
import { ChevronRight, Info, Loader2 } from 'lucide-react';
import { Input } from '@/client/components/template/ui/input';
import { Button } from '@/client/components/template/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/client/components/template/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/client/components/template/ui/dialog';
import { useIOSKeyboardOffset } from '@/client/lib/hooks';

interface EditableFieldProps {
    label: string;
    value: string;
    icon?: ReactNode;
    onSave?: (value: string) => Promise<boolean>;
    isSaving?: boolean;
    readOnly?: boolean;
    placeholder?: string;
    helperText?: string;
    infoTitle?: string;
    infoContent?: ReactNode;
}

export function EditableField({
    label,
    value,
    icon,
    onSave,
    isSaving,
    readOnly,
    placeholder,
    helperText,
    infoTitle,
    infoContent,
}: EditableFieldProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral edit mode toggle
    const [isOpen, setIsOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- form input before submission
    const [editValue, setEditValue] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);
    const keyboardOffset = useIOSKeyboardOffset();

    useEffect(() => {
        if (isOpen) {
            setEditValue(value);
            // Focus input after sheet animation
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 100);
        }
    }, [isOpen, value]);

    const handleOpen = () => {
        if (readOnly || !onSave) return;
        setIsOpen(true);
    };

    const handleCancel = () => {
        setEditValue(value);
        setIsOpen(false);
    };

    const handleSave = async () => {
        if (!onSave) return;

        // Don't save if value hasn't changed
        if (editValue === value) {
            setIsOpen(false);
            return;
        }

        const success = await onSave(editValue);
        if (success) {
            setIsOpen(false);
        }
    };

    const displayValue = value || placeholder || 'Not set';
    const isValueEmpty = !value;
    const isEditable = !readOnly && onSave;

    return (
        <>
            {/* Field row - tappable to edit */}
            <button
                type="button"
                onClick={handleOpen}
                disabled={!isEditable}
                className={`flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors ${
                    isEditable ? 'active:bg-muted/50' : ''
                }`}
            >
                {/* Label and icon */}
                <div className="flex items-center gap-3 min-w-0">
                    {icon && (
                        <span className="flex-shrink-0 text-muted-foreground">
                            {icon}
                        </span>
                    )}
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        {label}
                        {infoContent && (
                            <Dialog>
                                <DialogTrigger asChild>
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => { if (e.key === 'Enter') e.stopPropagation(); }}
                                        className="text-muted-foreground/60 hover:text-muted-foreground cursor-pointer"
                                    >
                                        <Info className="h-3.5 w-3.5" />
                                    </span>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>{infoTitle || 'Information'}</DialogTitle>
                                    </DialogHeader>
                                    <div className="mt-2">
                                        {infoContent}
                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}
                    </span>
                </div>

                {/* Value and chevron */}
                <div className="flex items-center gap-2 min-w-0">
                    <span
                        className={`text-sm truncate ${
                            isValueEmpty ? 'text-muted-foreground/60 italic' : 'text-foreground'
                        }`}
                    >
                        {displayValue}
                    </span>
                    {isEditable && (
                        <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground/50" />
                    )}
                </div>
            </button>

            {/* Helper text */}
            {helperText && (
                <p className="px-4 pb-3 text-xs text-muted-foreground leading-relaxed">
                    {helperText}
                </p>
            )}

            {/* Edit sheet */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetContent
                    side="bottom"
                    className="rounded-t-2xl"
                    style={{
                        // Push sheet up when iOS keyboard is open
                        transform: keyboardOffset > 0 ? `translateY(-${keyboardOffset}px)` : undefined,
                        transition: 'transform 0.1s ease-out',
                    }}
                >
                    <div className="mx-auto w-12 h-1.5 bg-muted rounded-full mb-4 mt-2" />

                    <SheetHeader className="px-4">
                        <SheetTitle>{label}</SheetTitle>
                    </SheetHeader>

                    <div className="p-4 space-y-4">
                        <Input
                            ref={inputRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            placeholder={placeholder}
                            disabled={isSaving}
                            className="h-12 text-base"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSave();
                            }}
                        />

                        {helperText && (
                            <p className="text-sm text-muted-foreground">
                                {helperText}
                            </p>
                        )}

                        <div className="flex gap-3 pt-2">
                            <Button
                                variant="outline"
                                className="flex-1 h-12"
                                onClick={handleCancel}
                                disabled={isSaving}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 h-12"
                                onClick={handleSave}
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    'Save'
                                )}
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </>
    );
}
