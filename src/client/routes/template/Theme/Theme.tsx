import React from 'react';
import { ThemeSettings } from '@/client/features';

export function Theme() {
    return (
        <div className="mx-auto max-w-3xl py-4">
            <h1 className="text-2xl font-semibold">Theme & Appearance</h1>
            <p className="mb-4 text-sm text-muted-foreground">
                Customize the colors, fonts, and visual style of the application
            </p>
            
            <ThemeSettings />
        </div>
    );
}

