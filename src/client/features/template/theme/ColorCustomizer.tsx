import React, { useCallback } from 'react';
import { RotateCcw, Sun, Moon } from 'lucide-react';
import { Button } from '@/client/components/template/ui/button';
import { Label } from '@/client/components/template/ui/label';
import { useThemeStore, useEffectiveColors, useHasCustomColors } from './store';
import { hslToHex, hexToHsl } from './utils';
import type { ThemeColors } from './types';

/**
 * Key colors that users can customize - organized by category
 */
const mainColors: { key: keyof ThemeColors; label: string; description: string }[] = [
    { key: 'primary', label: 'Primary', description: 'Main action color' },
    { key: 'secondary', label: 'Secondary', description: 'Secondary actions' },
    { key: 'accent', label: 'Accent', description: 'Highlights' },
    { key: 'background', label: 'Background', description: 'Page background' },
];

const statusColors: { key: keyof ThemeColors; label: string; description: string }[] = [
    { key: 'success', label: 'Success', description: 'Success background' },
    { key: 'successForeground', label: 'Success Text', description: 'Text on success' },
    { key: 'warning', label: 'Warning', description: 'Warning background' },
    { key: 'warningForeground', label: 'Warning Text', description: 'Text on warning' },
    { key: 'info', label: 'Info', description: 'Info background' },
    { key: 'infoForeground', label: 'Info Text', description: 'Text on info' },
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
        <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
                <Label className="text-sm font-medium">{label}</Label>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <div className="flex items-center gap-2">
                <div 
                    className="h-8 w-8 rounded-md border border-border"
                    style={{ backgroundColor: `hsl(${value})` }}
                />
                <input
                    type="color"
                    value={hexValue}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-8 w-14 cursor-pointer rounded border-0 bg-transparent p-0"
                    aria-label={`Pick ${label} color`}
                />
                <span className="hidden w-16 font-mono text-xs text-muted-foreground sm:block">
                    {hexValue}
                </span>
            </div>
        </div>
    );
}

/**
 * Color customization panel
 */
export function ColorCustomizer() {
    const effectiveColors = useEffectiveColors();
    const hasCustomColors = useHasCustomColors();
    const setCustomColor = useThemeStore((s) => s.setCustomColor);
    const resetCustomColors = useThemeStore((s) => s.resetCustomColors);
    const mode = useThemeStore((s) => s.settings.mode);
    const setMode = useThemeStore((s) => s.setMode);

    const handleColorChange = useCallback((key: keyof ThemeColors, hex: string) => {
        const hsl = hexToHsl(hex);
        setCustomColor(key, hsl);
    }, [setCustomColor]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-medium">Customize Colors</h3>
                    <p className="text-xs text-muted-foreground">
                        Override preset colors with your own
                    </p>
                </div>
                {hasCustomColors && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={resetCustomColors}
                        className="h-8 gap-1 text-xs"
                    >
                        <RotateCcw className="h-3 w-3" />
                        Reset
                    </Button>
                )}
            </div>

            {/* Mode indicator - shows which mode colors are being edited */}
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
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
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}
                    className="h-7 gap-1 text-xs"
                >
                    {mode === 'light' ? (
                        <>
                            <Moon className="h-3 w-3" />
                            Edit Dark
                        </>
                    ) : (
                        <>
                            <Sun className="h-3 w-3" />
                            Edit Light
                        </>
                    )}
                </Button>
            </div>

            {/* Main Colors */}
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Main Colors</h4>
                {mainColors.map(({ key, label, description }) => (
                    <ColorRow
                        key={key}
                        label={label}
                        description={description}
                        value={effectiveColors[key]}
                        onChange={(hex) => handleColorChange(key, hex)}
                    />
                ))}
            </div>

            {/* Status Colors */}
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status Colors</h4>
                {statusColors.map(({ key, label, description }) => (
                    <ColorRow
                        key={key}
                        label={label}
                        description={description}
                        value={effectiveColors[key]}
                        onChange={(hex) => handleColorChange(key, hex)}
                    />
                ))}
            </div>
        </div>
    );
}

