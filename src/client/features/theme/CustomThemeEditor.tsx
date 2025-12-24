import React, { useCallback, useState } from 'react';
import { RotateCcw, Sun, Moon, ChevronDown, ChevronRight, Palette } from 'lucide-react';
import { Button } from '@/client/components/ui/button';
import { Label } from '@/client/components/ui/label';
import { Card } from '@/client/components/ui/card';
import { useThemeStore, useEffectiveColors, useHasCustomColors, useHasAnyCustomColors } from './store';
import { hslToHex, hexToHsl } from './utils';
import { SaveThemeDialog } from './SaveThemeDialog';
import type { ThemeColors } from './types';

/**
 * Color groups for organized display
 */
const colorGroups: { 
    title: string; 
    description: string;
    colors: { key: keyof ThemeColors; label: string; description: string }[];
}[] = [
    {
        title: 'Core Colors',
        description: 'Main action and brand colors',
        colors: [
            { key: 'primary', label: 'Primary', description: 'Main action color (buttons, links)' },
            { key: 'primaryForeground', label: 'Primary Text', description: 'Text on primary background' },
            { key: 'secondary', label: 'Secondary', description: 'Secondary action color' },
            { key: 'secondaryForeground', label: 'Secondary Text', description: 'Text on secondary background' },
        ],
    },
    {
        title: 'Backgrounds',
        description: 'Page, card, and surface colors',
        colors: [
            { key: 'background', label: 'Background', description: 'Main page background' },
            { key: 'foreground', label: 'Foreground', description: 'Main text color' },
            { key: 'card', label: 'Card', description: 'Card and panel backgrounds' },
            { key: 'cardForeground', label: 'Card Text', description: 'Text on card backgrounds' },
            { key: 'muted', label: 'Muted', description: 'Subtle backgrounds (hover states)' },
            { key: 'mutedForeground', label: 'Muted Text', description: 'Secondary/helper text' },
        ],
    },
    {
        title: 'Accents & Highlights',
        description: 'Highlights and emphasis',
        colors: [
            { key: 'accent', label: 'Accent', description: 'Highlighted/selected items' },
            { key: 'accentForeground', label: 'Accent Text', description: 'Text on accent background' },
        ],
    },
    {
        title: 'Borders & Inputs',
        description: 'Form elements and dividers',
        colors: [
            { key: 'border', label: 'Border', description: 'Default border color' },
            { key: 'input', label: 'Input Border', description: 'Form input borders' },
            { key: 'ring', label: 'Focus Ring', description: 'Focus indicator color' },
        ],
    },
    {
        title: 'Status Colors',
        description: 'Feedback and alerts',
        colors: [
            { key: 'destructive', label: 'Destructive', description: 'Error/danger actions' },
            { key: 'destructiveForeground', label: 'Destructive Text', description: 'Text on destructive' },
            { key: 'success', label: 'Success', description: 'Success states' },
            { key: 'warning', label: 'Warning', description: 'Warning states' },
        ],
    },
];

/**
 * Individual color picker row
 */
function ColorRow({ 
    label, 
    description,
    value,
    onChange,
}: { 
    label: string; 
    description: string;
    value: string;
    onChange: (hex: string) => void;
}) {
    const hexValue = hslToHex(value);

    return (
        <div className="flex items-center justify-between gap-4 py-2">
            <div className="flex-1 min-w-0">
                <Label className="text-sm font-medium">{label}</Label>
                <p className="text-xs text-muted-foreground truncate">{description}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <div 
                    className="h-7 w-7 rounded-md border border-border shadow-sm"
                    style={{ backgroundColor: `hsl(${value})` }}
                />
                <input
                    type="color"
                    value={hexValue}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-7 w-12 cursor-pointer rounded border-0 bg-transparent p-0"
                    aria-label={`Pick ${label} color`}
                />
                <span className="hidden w-[4.5rem] font-mono text-xs text-muted-foreground sm:block">
                    {hexValue}
                </span>
            </div>
        </div>
    );
}

/**
 * Collapsible color group section
 */
function ColorGroupSection({
    title,
    description,
    colors,
    effectiveColors,
    onColorChange,
    defaultExpanded = false,
}: {
    title: string;
    description: string;
    colors: { key: keyof ThemeColors; label: string; description: string }[];
    effectiveColors: ThemeColors;
    onColorChange: (key: keyof ThemeColors, hex: string) => void;
    defaultExpanded?: boolean;
}) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI toggle
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <div className="border-b border-border last:border-b-0">
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex w-full items-center justify-between py-3 text-left hover:bg-muted/30 transition-colors px-1 -mx-1 rounded"
            >
                <div>
                    <h4 className="text-sm font-medium">{title}</h4>
                    <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
            </button>
            {isExpanded && (
                <div className="pb-3 space-y-1">
                    {colors.map(({ key, label, description }) => (
                        <ColorRow
                            key={key}
                            label={label}
                            description={description}
                            value={effectiveColors[key]}
                            onChange={(hex) => onColorChange(key, hex)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * Dedicated panel for editing custom themes with expanded options
 */
export function CustomThemeEditor() {
    const effectiveColors = useEffectiveColors();
    const hasCustomColors = useHasCustomColors();
    const hasAnyCustomColors = useHasAnyCustomColors();
    const setCustomColor = useThemeStore((s) => s.setCustomColor);
    const resetCustomColors = useThemeStore((s) => s.resetCustomColors);
    const resetAllCustomColors = useThemeStore((s) => s.resetAllCustomColors);
    const mode = useThemeStore((s) => s.settings.mode);
    const setMode = useThemeStore((s) => s.setMode);

    const handleColorChange = useCallback((key: keyof ThemeColors, hex: string) => {
        const hsl = hexToHsl(hex);
        setCustomColor(key, hsl);
    }, [setCustomColor]);

    return (
        <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Palette className="h-5 w-5 text-primary" />
                    <div>
                        <h3 className="text-sm font-semibold">Color Editor</h3>
                        <p className="text-xs text-muted-foreground">
                            Fine-tune colors for your theme
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {hasCustomColors && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={resetCustomColors}
                            className="h-8 gap-1 text-xs"
                            title={`Reset ${mode} mode colors`}
                        >
                            <RotateCcw className="h-3 w-3" />
                            Reset {mode === 'light' ? 'Light' : 'Dark'}
                        </Button>
                    )}
                    {hasAnyCustomColors && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={resetAllCustomColors}
                            className="h-8 gap-1 text-xs text-destructive hover:text-destructive"
                            title="Reset all custom colors"
                        >
                            <RotateCcw className="h-3 w-3" />
                            Reset All
                        </Button>
                    )}
                </div>
            </div>

            {/* Mode selector */}
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 mb-4">
                <div className="flex items-center gap-2">
                    {mode === 'light' ? (
                        <Sun className="h-4 w-4 text-warning" />
                    ) : (
                        <Moon className="h-4 w-4 text-info" />
                    )}
                    <span className="text-sm font-medium">
                        Editing {mode === 'light' ? 'Light' : 'Dark'} Mode
                    </span>
                </div>
                <div className="flex gap-1">
                    <Button
                        variant={mode === 'light' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setMode('light')}
                        className="h-7 w-7 p-0"
                        title="Edit light mode"
                    >
                        <Sun className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant={mode === 'dark' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setMode('dark')}
                        className="h-7 w-7 p-0"
                        title="Edit dark mode"
                    >
                        <Moon className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Color groups */}
            <div className="space-y-0">
                {colorGroups.map((group, index) => (
                    <ColorGroupSection
                        key={group.title}
                        title={group.title}
                        description={group.description}
                        colors={group.colors}
                        effectiveColors={effectiveColors}
                        onColorChange={handleColorChange}
                        defaultExpanded={index === 0}
                    />
                ))}
            </div>

            {/* Save as custom theme button */}
            <div className="mt-4 pt-4 border-t border-border flex justify-end">
                <SaveThemeDialog />
            </div>
        </Card>
    );
}

