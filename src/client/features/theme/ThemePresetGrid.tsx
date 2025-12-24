import React, { useState } from 'react';
import { Check, MoreVertical, Pencil, Trash2, Palette } from 'lucide-react';
import { Button } from '@/client/components/ui/button';
import { Input } from '@/client/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/client/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/client/components/ui/dialog';
import { themePresets, getPresetColors } from './presets';
import { useThemeStore, useSavedCustomThemes } from './store';
import { ColorEditorDialog } from './ColorEditorDialog';
import type { CustomTheme } from './types';
import { cn } from '@/client/lib/utils';

/**
 * Single theme card component with Edit button
 */
function ThemeCard({ 
    name,
    description,
    primaryColor,
    secondaryColor,
    backgroundColor,
    isSelected,
    onSelect,
    onEdit,
    onRename,
    onDelete,
    isCustom = false,
}: {
    name: string;
    description: string;
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    isSelected: boolean;
    onSelect: () => void;
    onEdit: () => void;
    onRename?: () => void;
    onDelete?: () => void;
    isCustom?: boolean;
}) {
    return (
        <div
            className={cn(
                'relative flex flex-col items-start gap-2 rounded-lg border p-3 transition-all',
                'hover:border-primary/50 hover:bg-muted/50',
                isSelected && 'border-primary bg-primary/5 ring-1 ring-primary'
            )}
        >
            {/* Clickable area for selection */}
            <button
                onClick={onSelect}
                className="absolute inset-0 z-0"
                aria-label={`Select ${name} theme`}
            />
            
            {/* Color swatches */}
            <div className="flex gap-1 relative z-10">
                <div
                    className="h-5 w-5 rounded-full border border-border/50"
                    style={{ backgroundColor: `hsl(${primaryColor})` }}
                    title="Primary"
                />
                <div
                    className="h-5 w-5 rounded-full border border-border/50"
                    style={{ backgroundColor: `hsl(${secondaryColor})` }}
                    title="Secondary"
                />
                <div
                    className="h-5 w-5 rounded-full border border-border/50"
                    style={{ backgroundColor: `hsl(${backgroundColor})` }}
                    title="Background"
                />
            </div>

            {/* Name and description */}
            <div className="w-full pr-5 relative z-10 pointer-events-none">
                <div className="text-sm font-medium">{name}</div>
                <div className="text-xs text-muted-foreground truncate">
                    {description}
                </div>
            </div>

            {/* Action buttons */}
            <div className="absolute right-2 top-2 flex items-center gap-1 z-10">
                {/* Edit button - always visible */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    title="Edit theme colors"
                >
                    <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>

                {/* Menu for custom themes */}
                {isCustom && (onRename || onDelete) ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {onRename && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(); }}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Rename
                                </DropdownMenuItem>
                            )}
                            {onDelete && (
                                <DropdownMenuItem 
                                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                    className="text-destructive focus:text-destructive"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : isSelected ? (
                    <Check className="h-4 w-4 text-primary" />
                ) : null}
            </div>
        </div>
    );
}

/**
 * Dialog for renaming a custom theme
 */
function RenameDialog({
    theme,
    open,
    onOpenChange,
    onSave,
}: {
    theme: CustomTheme | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (newName: string) => void;
}) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
    const [name, setName] = useState(theme?.name ?? '');
    
    React.useEffect(() => {
        if (theme) setName(theme.name);
    }, [theme]);
    
    const handleSave = () => {
        if (name.trim()) {
            onSave(name.trim());
            onOpenChange(false);
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Rename Theme</DialogTitle>
                    <DialogDescription>
                        Enter a new name for your custom theme.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Theme name"
                        maxLength={30}
                        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={!name.trim()}>
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Dialog for confirming theme deletion
 */
function DeleteDialog({
    theme,
    open,
    onOpenChange,
    onConfirm,
}: {
    theme: CustomTheme | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Delete Theme</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete &quot;{theme?.name}&quot;? This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button variant="destructive" onClick={() => { onConfirm(); onOpenChange(false); }}>
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Grid of theme preset cards for selection
 */
export function ThemePresetGrid() {
    const currentPresetId = useThemeStore((s) => s.settings.presetId);
    const setPreset = useThemeStore((s) => s.setPreset);
    const updateCustomTheme = useThemeStore((s) => s.updateCustomTheme);
    const deleteCustomTheme = useThemeStore((s) => s.deleteCustomTheme);
    const mode = useThemeStore((s) => s.settings.mode);
    const savedCustomThemes = useSavedCustomThemes();
    
    // Dialog states
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [renameTheme, setRenameTheme] = useState<CustomTheme | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [deleteThemeTarget, setDeleteThemeTarget] = useState<CustomTheme | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state for color editor
    const [editingThemeId, setEditingThemeId] = useState<string | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state for color editor
    const [editingCustomTheme, setEditingCustomTheme] = useState<CustomTheme | undefined>(undefined);
    
    const handleRename = (newName: string) => {
        if (renameTheme) {
            updateCustomTheme(renameTheme.id, { name: newName });
        }
    };
    
    const handleDelete = () => {
        if (deleteThemeTarget) {
            deleteCustomTheme(deleteThemeTarget.id);
        }
    };

    const handleEditPreset = (presetId: string) => {
        setEditingThemeId(presetId);
        setEditingCustomTheme(undefined);
    };

    const handleEditCustomTheme = (theme: CustomTheme) => {
        setEditingThemeId(theme.id);
        setEditingCustomTheme(theme);
    };

    return (
        <>
            {/* Built-in presets */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {themePresets.map((preset) => {
                    const isSelected = preset.id === currentPresetId;
                    const colors = preset[mode];

                    return (
                        <ThemeCard
                            key={preset.id}
                            name={preset.name}
                            description={preset.description}
                            primaryColor={colors.primary}
                            secondaryColor={colors.secondary}
                            backgroundColor={colors.background}
                            isSelected={isSelected}
                            onSelect={() => setPreset(preset.id)}
                            onEdit={() => handleEditPreset(preset.id)}
                        />
                    );
                })}
            </div>
            
            {/* Custom themes section */}
            {savedCustomThemes.length > 0 && (
                <div className="mt-4">
                    <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                        My Themes
                    </h4>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {savedCustomThemes.map((theme) => {
                            const isSelected = theme.id === currentPresetId;
                            const baseColors = getPresetColors(theme.basePresetId, mode);
                            const customColors = mode === 'light' ? theme.lightColors : theme.darkColors;
                            const colors = { ...baseColors, ...customColors };

                            return (
                                <ThemeCard
                                    key={theme.id}
                                    name={theme.name}
                                    description={`Based on ${themePresets.find(p => p.id === theme.basePresetId)?.name ?? 'Default'}`}
                                    primaryColor={colors.primary}
                                    secondaryColor={colors.secondary}
                                    backgroundColor={colors.background}
                                    isSelected={isSelected}
                                    onSelect={() => setPreset(theme.id)}
                                    onEdit={() => handleEditCustomTheme(theme)}
                                    onRename={() => setRenameTheme(theme)}
                                    onDelete={() => setDeleteThemeTarget(theme)}
                                    isCustom
                                />
                            );
                        })}
                    </div>
                </div>
            )}
            
            {/* Dialogs */}
            <RenameDialog
                theme={renameTheme}
                open={!!renameTheme}
                onOpenChange={(open) => !open && setRenameTheme(null)}
                onSave={handleRename}
            />
            <DeleteDialog
                theme={deleteThemeTarget}
                open={!!deleteThemeTarget}
                onOpenChange={(open) => !open && setDeleteThemeTarget(null)}
                onConfirm={handleDelete}
            />
            <ColorEditorDialog
                open={!!editingThemeId}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditingThemeId(null);
                        setEditingCustomTheme(undefined);
                    }
                }}
                editingThemeId={editingThemeId ?? 'default'}
                editingCustomTheme={editingCustomTheme}
            />
        </>
    );
}
