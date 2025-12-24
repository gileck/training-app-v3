import React from 'react';
import { Moon, Sun, RotateCcw } from 'lucide-react';
import { Card } from '@/client/components/ui/card';
import { Button } from '@/client/components/ui/button';
import { Separator } from '@/client/components/ui/separator';
import { useThemeStore } from './store';
import { ThemePresetGrid } from './ThemePresetGrid';
import { FontSelector } from './FontSelector';
import { ThemePreview } from './ThemePreview';

/**
 * Main theme settings component
 * 
 * Includes:
 * - Light/Dark mode toggle
 * - Theme preset selection (with edit button to open color editor dialog)
 * - Font selection
 * - Live preview
 */
export function ThemeSettings() {
    const mode = useThemeStore((s) => s.settings.mode);
    const setMode = useThemeStore((s) => s.setMode);
    const reset = useThemeStore((s) => s.reset);

    return (
        <Card className="p-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">Appearance</h2>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={reset}
                    className="h-8 gap-1 text-xs"
                >
                    <RotateCcw className="h-3 w-3" />
                    Reset All
                </Button>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
                Customize the look and feel of the application
            </p>

            {/* Light/Dark Mode Toggle - at the top */}
            <div className="mb-6">
                <h3 className="mb-2 text-sm font-medium">Mode</h3>
                <div className="flex gap-2">
                    <Button
                        variant={mode === 'light' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setMode('light')}
                        className="gap-1"
                    >
                        <Sun className="h-4 w-4" />
                        Light
                    </Button>
                    <Button
                        variant={mode === 'dark' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setMode('dark')}
                        className="gap-1"
                    >
                        <Moon className="h-4 w-4" />
                        Dark
                    </Button>
                </div>
            </div>

            <Separator className="my-4" />

            {/* Theme Presets - includes Edit button to open color editor dialog */}
            <div className="mb-6">
                <h3 className="mb-2 text-sm font-medium">Theme Presets</h3>
                <p className="mb-3 text-xs text-muted-foreground">
                    Click the palette icon on any theme to customize colors and create your own
                </p>
                <ThemePresetGrid />
            </div>

            <Separator className="my-4" />

            {/* Font Selection */}
            <div className="mb-6">
                <FontSelector />
            </div>

            <Separator className="my-4" />

            {/* Live Preview */}
            <ThemePreview />
        </Card>
    );
}
