/**
 * Built-in Theme Presets
 * 
 * Each preset defines both light and dark mode color values.
 * Colors are HSL values without the hsl() wrapper.
 */

import type { ThemePreset, ThemeColors, BaseThemeColors } from './types';

/**
 * Default theme - Modern blue/violet (matches current app styling)
 */
const defaultTheme: ThemePreset = {
    id: 'default',
    name: 'Default',
    description: 'Clean blue and violet accents',
    light: {
        background: '220 30% 96%',
        foreground: '222 47% 11%',
        card: '220 25% 99%',
        cardForeground: '222 47% 11%',
        popover: '220 25% 99%',
        popoverForeground: '222 47% 11%',
        muted: '220 25% 93%',
        mutedForeground: '215 16% 47%',
        primary: '221 83% 53%',
        primaryForeground: '210 40% 98%',
        secondary: '262 83% 58%',
        secondaryForeground: '210 40% 98%',
        accent: '220 30% 94%',
        accentForeground: '222 47% 11%',
        destructive: '0 84% 60%',
        destructiveForeground: '210 40% 98%',
        border: '220 25% 88%',
        input: '220 25% 88%',
        ring: '221 83% 53%',
        success: '142 71% 45%',
        warning: '48 96% 53%',
    },
    dark: {
        background: '222 47% 6%',
        foreground: '210 40% 96%',
        card: '222 47% 6%',
        cardForeground: '210 40% 98%',
        popover: '222 47% 6%',
        popoverForeground: '210 40% 98%',
        muted: '217 33% 17%',
        mutedForeground: '215 20% 65%',
        primary: '217 91% 60%',
        primaryForeground: '222 84% 5%',
        secondary: '263 89% 67%',
        secondaryForeground: '222 84% 5%',
        accent: '217 33% 17%',
        accentForeground: '210 40% 98%',
        destructive: '0 63% 31%',
        destructiveForeground: '210 40% 98%',
        border: '217 33% 17%',
        input: '217 33% 17%',
        ring: '217 91% 60%',
        success: '142 71% 45%',
        warning: '48 96% 53%',
    },
};

/**
 * Ocean theme - Teal and cyan tones
 */
const oceanTheme: ThemePreset = {
    id: 'ocean',
    name: 'Ocean',
    description: 'Calming teal and cyan',
    light: {
        background: '185 35% 94%',
        foreground: '192 47% 11%',
        card: '185 30% 98%',
        cardForeground: '192 47% 11%',
        popover: '185 30% 98%',
        popoverForeground: '192 47% 11%',
        muted: '185 30% 90%',
        mutedForeground: '185 16% 47%',
        primary: '175 84% 32%',
        primaryForeground: '180 40% 98%',
        secondary: '199 89% 48%',
        secondaryForeground: '180 40% 98%',
        accent: '185 35% 92%',
        accentForeground: '192 47% 11%',
        destructive: '0 84% 60%',
        destructiveForeground: '210 40% 98%',
        border: '185 28% 85%',
        input: '185 28% 85%',
        ring: '175 84% 32%',
        success: '142 71% 45%',
        warning: '48 96% 53%',
    },
    dark: {
        background: '192 47% 6%',
        foreground: '180 40% 96%',
        card: '192 47% 8%',
        cardForeground: '180 40% 98%',
        popover: '192 47% 8%',
        popoverForeground: '180 40% 98%',
        muted: '187 33% 17%',
        mutedForeground: '185 20% 65%',
        primary: '175 70% 41%',
        primaryForeground: '192 84% 5%',
        secondary: '199 89% 48%',
        secondaryForeground: '192 84% 5%',
        accent: '187 33% 17%',
        accentForeground: '180 40% 98%',
        destructive: '0 63% 31%',
        destructiveForeground: '210 40% 98%',
        border: '187 33% 17%',
        input: '187 33% 17%',
        ring: '175 70% 41%',
        success: '142 71% 45%',
        warning: '48 96% 53%',
    },
};

/**
 * Forest theme - Green and emerald tones
 */
const forestTheme: ThemePreset = {
    id: 'forest',
    name: 'Forest',
    description: 'Natural greens and earthy tones',
    light: {
        background: '140 25% 93%',
        foreground: '140 47% 11%',
        card: '140 20% 97%',
        cardForeground: '140 47% 11%',
        popover: '140 20% 97%',
        popoverForeground: '140 47% 11%',
        muted: '140 22% 89%',
        mutedForeground: '135 16% 47%',
        primary: '142 71% 35%',
        primaryForeground: '120 40% 98%',
        secondary: '158 64% 40%',
        secondaryForeground: '120 40% 98%',
        accent: '140 25% 91%',
        accentForeground: '140 47% 11%',
        destructive: '0 84% 60%',
        destructiveForeground: '210 40% 98%',
        border: '140 20% 84%',
        input: '140 20% 84%',
        ring: '142 71% 35%',
        success: '142 71% 45%',
        warning: '48 96% 53%',
    },
    dark: {
        background: '140 47% 6%',
        foreground: '120 40% 96%',
        card: '140 47% 8%',
        cardForeground: '120 40% 98%',
        popover: '140 47% 8%',
        popoverForeground: '120 40% 98%',
        muted: '137 33% 17%',
        mutedForeground: '135 20% 65%',
        primary: '142 70% 45%',
        primaryForeground: '140 84% 5%',
        secondary: '158 64% 52%',
        secondaryForeground: '140 84% 5%',
        accent: '137 33% 17%',
        accentForeground: '120 40% 98%',
        destructive: '0 63% 31%',
        destructiveForeground: '210 40% 98%',
        border: '137 33% 17%',
        input: '137 33% 17%',
        ring: '142 70% 45%',
        success: '142 71% 45%',
        warning: '48 96% 53%',
    },
};

/**
 * Sunset theme - Orange and amber warmth
 */
const sunsetTheme: ThemePreset = {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm oranges and golden tones',
    light: {
        background: '38 45% 93%',
        foreground: '30 47% 11%',
        card: '38 40% 97%',
        cardForeground: '30 47% 11%',
        popover: '38 40% 97%',
        popoverForeground: '30 47% 11%',
        muted: '38 38% 88%',
        mutedForeground: '32 16% 47%',
        primary: '25 95% 53%',
        primaryForeground: '35 40% 98%',
        secondary: '45 93% 47%',
        secondaryForeground: '30 47% 11%',
        accent: '38 40% 90%',
        accentForeground: '30 47% 11%',
        destructive: '0 84% 60%',
        destructiveForeground: '210 40% 98%',
        border: '38 30% 82%',
        input: '38 30% 82%',
        ring: '25 95% 53%',
        success: '142 71% 45%',
        warning: '48 96% 53%',
    },
    dark: {
        background: '30 47% 6%',
        foreground: '35 40% 96%',
        card: '30 47% 8%',
        cardForeground: '35 40% 98%',
        popover: '30 47% 8%',
        popoverForeground: '35 40% 98%',
        muted: '28 33% 17%',
        mutedForeground: '32 20% 65%',
        primary: '25 95% 55%',
        primaryForeground: '30 84% 5%',
        secondary: '45 93% 50%',
        secondaryForeground: '30 84% 5%',
        accent: '28 33% 17%',
        accentForeground: '35 40% 98%',
        destructive: '0 63% 31%',
        destructiveForeground: '210 40% 98%',
        border: '28 33% 17%',
        input: '28 33% 17%',
        ring: '25 95% 55%',
        success: '142 71% 45%',
        warning: '48 96% 53%',
    },
};

/**
 * Rose theme - Pink and rose tones
 */
const roseTheme: ThemePreset = {
    id: 'rose',
    name: 'Rose',
    description: 'Soft pinks and rose accents',
    light: {
        background: '350 40% 94%',
        foreground: '340 47% 11%',
        card: '350 35% 98%',
        cardForeground: '340 47% 11%',
        popover: '350 35% 98%',
        popoverForeground: '340 47% 11%',
        muted: '350 35% 90%',
        mutedForeground: '345 16% 47%',
        primary: '346 77% 50%',
        primaryForeground: '350 40% 98%',
        secondary: '330 81% 60%',
        secondaryForeground: '350 40% 98%',
        accent: '350 38% 92%',
        accentForeground: '340 47% 11%',
        destructive: '0 84% 60%',
        destructiveForeground: '210 40% 98%',
        border: '350 30% 85%',
        input: '350 30% 85%',
        ring: '346 77% 50%',
        success: '142 71% 45%',
        warning: '48 96% 53%',
    },
    dark: {
        background: '340 47% 6%',
        foreground: '350 40% 96%',
        card: '340 47% 8%',
        cardForeground: '350 40% 98%',
        popover: '340 47% 8%',
        popoverForeground: '350 40% 98%',
        muted: '342 33% 17%',
        mutedForeground: '345 20% 65%',
        primary: '346 77% 55%',
        primaryForeground: '340 84% 5%',
        secondary: '330 81% 65%',
        secondaryForeground: '340 84% 5%',
        accent: '342 33% 17%',
        accentForeground: '350 40% 98%',
        destructive: '0 63% 31%',
        destructiveForeground: '210 40% 98%',
        border: '342 33% 17%',
        input: '342 33% 17%',
        ring: '346 77% 55%',
        success: '142 71% 45%',
        warning: '48 96% 53%',
    },
};

/**
 * Midnight theme - Deep purple and indigo
 */
const midnightTheme: ThemePreset = {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep purples and rich indigo',
    light: {
        background: '262 35% 94%',
        foreground: '263 47% 11%',
        card: '262 30% 98%',
        cardForeground: '263 47% 11%',
        popover: '262 30% 98%',
        popoverForeground: '263 47% 11%',
        muted: '262 28% 90%',
        mutedForeground: '261 16% 47%',
        primary: '263 70% 50%',
        primaryForeground: '260 40% 98%',
        secondary: '238 83% 55%',
        secondaryForeground: '260 40% 98%',
        accent: '262 32% 92%',
        accentForeground: '263 47% 11%',
        destructive: '0 84% 60%',
        destructiveForeground: '210 40% 98%',
        border: '262 25% 84%',
        input: '262 25% 84%',
        ring: '263 70% 50%',
        success: '142 71% 45%',
        warning: '48 96% 53%',
    },
    dark: {
        background: '263 47% 6%',
        foreground: '260 40% 96%',
        card: '263 47% 8%',
        cardForeground: '260 40% 98%',
        popover: '263 47% 8%',
        popoverForeground: '260 40% 98%',
        muted: '262 33% 17%',
        mutedForeground: '261 20% 65%',
        primary: '263 70% 60%',
        primaryForeground: '263 84% 5%',
        secondary: '238 83% 65%',
        secondaryForeground: '263 84% 5%',
        accent: '262 33% 17%',
        accentForeground: '260 40% 98%',
        destructive: '0 63% 31%',
        destructiveForeground: '210 40% 98%',
        border: '262 33% 17%',
        input: '262 33% 17%',
        ring: '263 70% 60%',
        success: '142 71% 45%',
        warning: '48 96% 53%',
    },
};

/**
 * Monochrome theme - Elegant grayscale
 */
const monochromeTheme: ThemePreset = {
    id: 'monochrome',
    name: 'Monochrome',
    description: 'Clean and minimal grayscale',
    light: {
        background: '0 0% 94%',
        foreground: '0 0% 9%',
        card: '0 0% 98%',
        cardForeground: '0 0% 9%',
        popover: '0 0% 98%',
        popoverForeground: '0 0% 9%',
        muted: '0 0% 88%',
        mutedForeground: '0 0% 45%',
        primary: '0 0% 15%',
        primaryForeground: '0 0% 98%',
        secondary: '0 0% 35%',
        secondaryForeground: '0 0% 98%',
        accent: '0 0% 90%',
        accentForeground: '0 0% 9%',
        destructive: '0 84% 60%',
        destructiveForeground: '0 0% 98%',
        border: '0 0% 82%',
        input: '0 0% 82%',
        ring: '0 0% 15%',
        success: '142 71% 45%',
        warning: '48 96% 53%',
    },
    dark: {
        background: '0 0% 5%',
        foreground: '0 0% 95%',
        card: '0 0% 7%',
        cardForeground: '0 0% 95%',
        popover: '0 0% 7%',
        popoverForeground: '0 0% 95%',
        muted: '0 0% 15%',
        mutedForeground: '0 0% 65%',
        primary: '0 0% 90%',
        primaryForeground: '0 0% 5%',
        secondary: '0 0% 70%',
        secondaryForeground: '0 0% 5%',
        accent: '0 0% 15%',
        accentForeground: '0 0% 95%',
        destructive: '0 63% 31%',
        destructiveForeground: '0 0% 98%',
        border: '0 0% 15%',
        input: '0 0% 15%',
        ring: '0 0% 90%',
        success: '142 71% 45%',
        warning: '48 96% 53%',
    },
};

/**
 * Earth theme - Warm browns and terracotta
 */
const earthTheme: ThemePreset = {
    id: 'earth',
    name: 'Earth',
    description: 'Warm browns and terracotta tones',
    light: {
        background: '32 35% 92%',
        foreground: '25 30% 12%',
        card: '32 30% 97%',
        cardForeground: '25 30% 12%',
        popover: '32 30% 97%',
        popoverForeground: '25 30% 12%',
        muted: '32 28% 87%',
        mutedForeground: '25 15% 45%',
        primary: '16 65% 45%',
        primaryForeground: '30 40% 98%',
        secondary: '35 60% 50%',
        secondaryForeground: '30 40% 98%',
        accent: '32 30% 89%',
        accentForeground: '25 30% 12%',
        destructive: '0 84% 60%',
        destructiveForeground: '210 40% 98%',
        border: '32 22% 80%',
        input: '32 22% 80%',
        ring: '16 65% 45%',
        success: '142 71% 45%',
        warning: '48 96% 53%',
    },
    dark: {
        background: '25 30% 6%',
        foreground: '30 25% 95%',
        card: '25 30% 8%',
        cardForeground: '30 25% 95%',
        popover: '25 30% 8%',
        popoverForeground: '30 25% 95%',
        muted: '25 25% 15%',
        mutedForeground: '28 20% 60%',
        primary: '16 65% 50%',
        primaryForeground: '25 84% 5%',
        secondary: '35 60% 55%',
        secondaryForeground: '25 84% 5%',
        accent: '25 25% 15%',
        accentForeground: '30 25% 95%',
        destructive: '0 63% 31%',
        destructiveForeground: '210 40% 98%',
        border: '25 25% 15%',
        input: '25 25% 15%',
        ring: '16 65% 50%',
        success: '142 71% 45%',
        warning: '48 96% 53%',
    },
};

/**
 * All available theme presets
 */
export const themePresets: ThemePreset[] = [
    defaultTheme,
    oceanTheme,
    forestTheme,
    sunsetTheme,
    roseTheme,
    midnightTheme,
    monochromeTheme,
    earthTheme,
];

/**
 * Get a theme preset by ID
 */
export function getThemePreset(id: string): ThemePreset | undefined {
    return themePresets.find(preset => preset.id === id);
}

/**
 * Get the default theme preset
 */
export function getDefaultPreset(): ThemePreset {
    return defaultTheme;
}

/**
 * Add layout colors (header/footer) to base theme colors.
 * Header defaults to card colors, Footer defaults to muted colors.
 */
function withLayoutColors(colors: BaseThemeColors): ThemeColors {
    return {
        ...colors,
        header: colors.card,
        headerForeground: colors.cardForeground,
        footer: colors.muted,
        footerForeground: colors.mutedForeground,
    };
}

/**
 * Get colors for a specific mode from a preset.
 * Always returns complete ThemeColors with header/footer derived from base colors.
 */
export function getPresetColors(presetId: string, mode: 'light' | 'dark'): ThemeColors {
    const preset = getThemePreset(presetId) ?? defaultTheme;
    const baseColors = preset[mode];
    return withLayoutColors(baseColors);
}

