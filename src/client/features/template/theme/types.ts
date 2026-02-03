/**
 * Theme Feature Types
 * 
 * Defines the structure for theme colors, presets, and settings.
 */

/**
 * Base color tokens that define a theme (without layout colors).
 * Values are HSL without the hsl() wrapper (e.g., "221 83% 53%")
 */
export interface BaseThemeColors {
    // Backgrounds
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    muted: string;
    mutedForeground: string;
    
    // Actions
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;
    
    // Borders & inputs
    border: string;
    input: string;
    ring: string;
    
    // Status colors
    success: string;
    successForeground: string;
    warning: string;
    warningForeground: string;
    info: string;
    infoForeground: string;
}

/**
 * Complete color tokens including layout colors.
 * This is the full theme color interface used throughout the app.
 */
export interface ThemeColors extends BaseThemeColors {
    // Layout colors (header/footer)
    header: string;
    headerForeground: string;
    footer: string;
    footerForeground: string;
}

/**
 * A theme preset with both light and dark variants
 * Uses BaseThemeColors since header/footer are derived automatically
 */
export interface ThemePreset {
    id: string;
    name: string;
    description: string;
    light: BaseThemeColors;
    dark: BaseThemeColors;
}

/**
 * Font family preset definition
 */
export interface FontPreset {
    id: string;
    name: string;
    fontFamily: string;
    googleFontUrl?: string; // URL to load from Google Fonts
    description: string;
}

/**
 * Custom color overrides for a specific mode
 */
export interface ModeColors {
    light: Partial<ThemeColors> | null;
    dark: Partial<ThemeColors> | null;
}

/**
 * A user-created custom theme
 */
export interface CustomTheme {
    /** Unique identifier (e.g., "custom-1703123456789") */
    id: string;
    /** User-provided name */
    name: string;
    /** Base preset this theme was derived from */
    basePresetId: string;
    /** Custom color overrides for light mode */
    lightColors: Partial<ThemeColors>;
    /** Custom color overrides for dark mode */
    darkColors: Partial<ThemeColors>;
    /** Creation timestamp */
    createdAt: number;
}

/**
 * User's theme settings (persisted)
 */
export interface ThemeConfig {
    /** Selected theme preset ID, or custom theme ID (e.g., "custom-xxx") */
    presetId: string;
    /** Custom color overrides for current editing session (applied on top of preset) */
    customColors: ModeColors;
    /** Selected font family preset ID */
    fontFamily: string;
    /** Light or dark mode */
    mode: 'light' | 'dark';
    /** User's saved custom themes */
    savedCustomThemes: CustomTheme[];
}

/**
 * Default theme settings
 */
export const defaultThemeSettings: ThemeConfig = {
    presetId: 'default',
    customColors: { light: null, dark: null },
    fontFamily: 'system',
    mode: 'light',
    savedCustomThemes: [],
};

/**
 * Check if a theme ID is a custom theme
 */
export function isCustomThemeId(id: string): boolean {
    return id.startsWith('custom-');
}

/**
 * Generate a unique custom theme ID
 */
export function generateCustomThemeId(): string {
    return `custom-${Date.now()}`;
}

/**
 * CSS variable name mapping from ThemeColors keys to CSS custom property names
 */
export const colorToCssVar: Record<keyof ThemeColors, string> = {
    background: '--background',
    foreground: '--foreground',
    card: '--card',
    cardForeground: '--card-foreground',
    popover: '--popover',
    popoverForeground: '--popover-foreground',
    muted: '--muted',
    mutedForeground: '--muted-foreground',
    primary: '--primary',
    primaryForeground: '--primary-foreground',
    secondary: '--secondary',
    secondaryForeground: '--secondary-foreground',
    accent: '--accent',
    accentForeground: '--accent-foreground',
    destructive: '--destructive',
    destructiveForeground: '--destructive-foreground',
    border: '--border',
    input: '--input',
    ring: '--ring',
    success: '--success',
    successForeground: '--success-foreground',
    warning: '--warning',
    warningForeground: '--warning-foreground',
    info: '--info',
    infoForeground: '--info-foreground',
    header: '--header',
    headerForeground: '--header-foreground',
    footer: '--footer',
    footerForeground: '--footer-foreground',
};

