/**
 * ThemeSettings Route
 * 
 * This route wraps the theme settings component from the theme feature.
 * It provides a full-page view with the page header.
 */
import React from 'react';
import { Palette } from 'lucide-react';
import { ThemeSettings as ThemeSettingsCard } from '@/client/features/template/theme';

export function ThemeSettings() {
    return (
        <div className="mx-auto max-w-3xl pb-20 px-4 py-4">
            <h1 className="text-xl font-semibold flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Theme & Appearance
            </h1>
            <p className="mt-1 text-sm text-muted-foreground mb-4">
                Customize the look and feel of the app
            </p>

            <ThemeSettingsCard />
        </div>
    );
}
