import React, { useCallback, useState, useEffect } from 'react';
import { RotateCcw, Sun, Moon, ChevronDown, Palette, Save, X, Sparkles } from 'lucide-react';
import { Button } from '@/client/components/template/ui/button';
import { Input } from '@/client/components/template/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/client/components/template/ui/dialog';
import { useThemeStore, useEffectiveColors, useHasCustomColors, useHasAnyCustomColors } from './store';
import { hslToHex, hexToHsl } from './utils';
import { themePresets } from './presets';
import { isCustomThemeId } from './types';
import type { ThemeColors, CustomTheme } from './types';
import { cn } from '@/client/lib/utils';

/**
 * Color groups for organized display
 */
const colorGroups: { 
    title: string; 
    colors: { key: keyof ThemeColors; label: string }[];
}[] = [
    {
        title: 'Brand',
        colors: [
            { key: 'primary', label: 'Primary' },
            { key: 'primaryForeground', label: 'Primary Text' },
            { key: 'secondary', label: 'Secondary' },
            { key: 'secondaryForeground', label: 'Secondary Text' },
        ],
    },
    {
        title: 'Surfaces',
        colors: [
            { key: 'background', label: 'Background' },
            { key: 'foreground', label: 'Text' },
            { key: 'card', label: 'Card' },
            { key: 'cardForeground', label: 'Card Text' },
            { key: 'muted', label: 'Muted' },
            { key: 'mutedForeground', label: 'Muted Text' },
        ],
    },
    {
        title: 'Layout',
        colors: [
            { key: 'header', label: 'Header' },
            { key: 'headerForeground', label: 'Header Text' },
            { key: 'footer', label: 'Footer' },
            { key: 'footerForeground', label: 'Footer Text' },
        ],
    },
    {
        title: 'Accent & UI',
        colors: [
            { key: 'accent', label: 'Accent' },
            { key: 'accentForeground', label: 'Accent Text' },
            { key: 'border', label: 'Border' },
            { key: 'input', label: 'Input' },
            { key: 'ring', label: 'Focus Ring' },
        ],
    },
    {
        title: 'Status',
        colors: [
            { key: 'destructive', label: 'Error' },
            { key: 'warning', label: 'Warning' },
            { key: 'success', label: 'Success' },
            { key: 'info', label: 'Info' },
            { key: 'destructiveForeground', label: 'Error Text' },
            { key: 'warningForeground', label: 'Warning Text' },
            { key: 'successForeground', label: 'Success Text' },
            { key: 'infoForeground', label: 'Info Text' },
        ],
    },
];

/**
 * Color swatch with picker
 */
function ColorSwatch({ 
    label, 
    value,
    onChange,
}: { 
    label: string; 
    value: string;
    onChange: (hex: string) => void;
}) {
    const hexValue = hslToHex(value);

    return (
        <div className="group relative">
            <label className="flex flex-col items-center gap-1.5 cursor-pointer">
                <div className="relative">
                    <div 
                        className="h-10 w-10 rounded-lg border-2 border-border shadow-sm transition-all group-hover:scale-110 group-hover:shadow-md"
                        style={{ backgroundColor: `hsl(${value})` }}
                    />
                    <input
                        type="color"
                        value={hexValue}
                        onChange={(e) => onChange(e.target.value)}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        aria-label={`Pick ${label} color`}
                    />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground text-center leading-tight max-w-[60px] truncate">
                    {label}
                </span>
            </label>
        </div>
    );
}

/**
 * Collapsible color group section
 */
function ColorGroupSection({
    title,
    colors,
    effectiveColors,
    onColorChange,
    isExpanded,
    onToggle,
    twoRowLayout,
}: {
    title: string;
    colors: { key: keyof ThemeColors; label: string }[];
    effectiveColors: ThemeColors;
    onColorChange: (key: keyof ThemeColors, hex: string) => void;
    isExpanded: boolean;
    onToggle: () => void;
    twoRowLayout?: boolean;
}) {
    return (
        <div className="rounded-lg border border-border bg-card/50 overflow-hidden">
            <button
                type="button"
                onClick={onToggle}
                className={cn(
                    "flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors",
                    "hover:bg-muted/50",
                    isExpanded && "border-b border-border"
                )}
            >
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{title}</span>
                    <span className="text-xs text-muted-foreground">({colors.length})</span>
                </div>
                <ChevronDown
                    className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        isExpanded && "rotate-180"
                    )}
                />
            </button>
            {isExpanded && (
                <div className="p-3 bg-background/50">
                    <div className={cn(
                        "gap-3",
                        twoRowLayout
                            ? "grid grid-cols-4 grid-rows-2"
                            : "flex flex-wrap"
                    )}>
                        {colors.map(({ key, label }) => (
                            <ColorSwatch
                                key={key}
                                label={label}
                                value={effectiveColors[key]}
                                onChange={(hex) => onColorChange(key, hex)}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Theme preview strip showing key colors
 */
function ThemePreviewStrip({ colors }: { colors: ThemeColors }) {
    const previewColors = [
        { key: 'primary', label: 'Pri' },
        { key: 'secondary', label: 'Sec' },
        { key: 'background', label: 'Bg' },
        { key: 'card', label: 'Card' },
        { key: 'accent', label: 'Acc' },
    ] as const;

    return (
        <div className="flex gap-1">
            {previewColors.map(({ key }) => (
                <div
                    key={key}
                    className="h-6 w-6 rounded-md border border-border/50 shadow-sm"
                    style={{ backgroundColor: `hsl(${colors[key]})` }}
                />
            ))}
        </div>
    );
}

interface ColorEditorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The theme being edited (preset ID or custom theme ID) */
    editingThemeId: string;
    /** If editing an existing custom theme */
    editingCustomTheme?: CustomTheme;
}

/**
 * Dialog for editing theme colors
 */
export function ColorEditorDialog({ 
    open, 
    onOpenChange, 
    editingThemeId,
    editingCustomTheme,
}: ColorEditorDialogProps) {
    const effectiveColors = useEffectiveColors();
    const hasCustomColors = useHasCustomColors();
    const hasAnyCustomColors = useHasAnyCustomColors();
    const setCustomColor = useThemeStore((s) => s.setCustomColor);
    const resetCustomColors = useThemeStore((s) => s.resetCustomColors);
    const resetAllCustomColors = useThemeStore((s) => s.resetAllCustomColors);
    const saveAsCustomTheme = useThemeStore((s) => s.saveAsCustomTheme);
    const saveCustomTheme = useThemeStore((s) => s.saveCustomTheme);
    const mode = useThemeStore((s) => s.settings.mode);
    const setMode = useThemeStore((s) => s.setMode);
    const setPreset = useThemeStore((s) => s.setPreset);
    
    // Check if we're editing an existing custom theme
    const isEditingCustomTheme = !!editingCustomTheme;
    
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [themeName, setThemeName] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [showSaveInput, setShowSaveInput] = useState(false);
    // Track which color groups are expanded (persists across color changes)
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set(['Brand']));

    // Get the theme name for display
    const displayThemeName = editingCustomTheme?.name ?? 
        themePresets.find(p => p.id === editingThemeId)?.name ?? 
        'Theme';

    // Toggle a group's expanded state
    const toggleGroup = useCallback((title: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(title)) {
                next.delete(title);
            } else {
                next.add(title);
            }
            return next;
        });
    }, []);

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            setThemeName('');
            setShowSaveInput(false);
            setExpandedGroups(new Set(['Brand'])); // Default: Brand expanded
            // Set the preset being edited as active so colors apply
            if (!isCustomThemeId(editingThemeId) || editingCustomTheme) {
                setPreset(editingThemeId);
            }
        }
    }, [open, editingThemeId, editingCustomTheme, setPreset]);

    const handleColorChange = useCallback((key: keyof ThemeColors, hex: string) => {
        const hsl = hexToHsl(hex);
        setCustomColor(key, hsl);
    }, [setCustomColor]);

    const handleSaveNew = () => {
        if (!themeName.trim()) return;
        saveAsCustomTheme(themeName.trim());
        onOpenChange(false);
    };
    
    const handleSaveExisting = () => {
        if (!editingCustomTheme) return;
        saveCustomTheme(editingCustomTheme.id);
        onOpenChange(false);
    };

    const handleCancel = () => {
        // Reset custom colors when canceling
        resetAllCustomColors();
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleCancel}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0">
                {/* Header - pr-10 to make room for the close button */}
                <DialogHeader className="shrink-0 px-5 pt-5 pb-0 pr-10">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20">
                                <Palette className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                                <DialogTitle className="text-lg truncate">
                                    {displayThemeName}
                                </DialogTitle>
                                <DialogDescription className="text-xs">
                                    {isEditingCustomTheme ? 'Edit your custom theme' : 'Customize and save as new'}
                                </DialogDescription>
                            </div>
                        </div>
                        <ThemePreviewStrip colors={effectiveColors} />
                    </div>
                </DialogHeader>

                {/* Mode Toggle */}
                <div className="shrink-0 px-5 py-3">
                    <div className="flex items-center justify-between rounded-xl bg-muted/50 p-1">
                        <button
                            type="button"
                            onClick={() => setMode('light')}
                            className={cn(
                                "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                                mode === 'light' 
                                    ? "bg-background text-foreground shadow-sm" 
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Sun className="h-4 w-4" />
                            Light
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('dark')}
                            className={cn(
                                "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                                mode === 'dark' 
                                    ? "bg-background text-foreground shadow-sm" 
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Moon className="h-4 w-4" />
                            Dark
                        </button>
                        {hasCustomColors && (
                            <button
                                type="button"
                                onClick={resetCustomColors}
                                className="flex items-center gap-1 rounded-lg px-2 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                title="Reset colors for this mode"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Color Groups */}
                <div className="flex-1 overflow-y-auto min-h-0 px-5 pb-3">
                    <div className="space-y-2">
                        {colorGroups.map((group) => (
                            <ColorGroupSection
                                key={group.title}
                                title={group.title}
                                colors={group.colors}
                                effectiveColors={effectiveColors}
                                onColorChange={handleColorChange}
                                isExpanded={expandedGroups.has(group.title)}
                                onToggle={() => toggleGroup(group.title)}
                                twoRowLayout={group.title === 'Status'}
                            />
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 border-t border-border bg-muted/30 px-5 py-4">
                    {showSaveInput ? (
                        <div className="flex gap-2">
                            <Input
                                placeholder="Enter theme name..."
                                value={themeName}
                                onChange={(e) => setThemeName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveNew()}
                                className="flex-1"
                                autoFocus
                            />
                            <Button onClick={handleSaveNew} disabled={!themeName.trim()} size="sm">
                                <Save className="h-4 w-4 mr-1.5" />
                                Create
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setShowSaveInput(false)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between">
                            <Button variant="ghost" size="sm" onClick={handleCancel}>
                                Cancel
                            </Button>
                            <div className="flex gap-2">
                                {isEditingCustomTheme ? (
                                    <>
                                        <Button 
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setShowSaveInput(true)}
                                            disabled={!hasAnyCustomColors}
                                        >
                                            <Sparkles className="h-4 w-4 mr-1.5" />
                                            Save as New
                                        </Button>
                                        <Button 
                                            size="sm"
                                            onClick={handleSaveExisting}
                                            disabled={!hasAnyCustomColors}
                                        >
                                            <Save className="h-4 w-4 mr-1.5" />
                                            Save Changes
                                        </Button>
                                    </>
                                ) : (
                                    <Button 
                                        size="sm"
                                        onClick={() => setShowSaveInput(true)}
                                        disabled={!hasAnyCustomColors}
                                    >
                                        <Sparkles className="h-4 w-4 mr-1.5" />
                                        Save as New Theme
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
