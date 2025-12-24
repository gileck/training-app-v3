/**
 * Theme Store
 * 
 * Manages theme settings with localStorage persistence.
 * Supports built-in presets and user-created custom themes.
 */

import { createStore } from '@/client/stores';
import type { ThemeConfig, ThemeColors, CustomTheme, ModeColors } from './types';
import { defaultThemeSettings, isCustomThemeId, generateCustomThemeId } from './types';
import { applyThemeColors, applyFontFamily, applyMode } from './utils';
import { getGoogleFontUrl } from './fonts';
import { getPresetColors } from './presets';

interface ThemeState {
    /** Current theme settings */
    settings: ThemeConfig;
    /** Whether the theme has been initialized/applied */
    initialized: boolean;
    
    // Preset and mode actions
    /** Update theme preset */
    setPreset: (presetId: string) => void;
    /** Update light/dark mode */
    setMode: (mode: 'light' | 'dark') => void;
    /** Update font family */
    setFontFamily: (fontId: string) => void;
    
    // Custom color actions (for editing session)
    /** Update a single custom color for current mode */
    setCustomColor: (key: keyof ThemeColors, value: string) => void;
    /** Reset custom colors for current mode */
    resetCustomColors: () => void;
    /** Reset all custom colors (both modes) */
    resetAllCustomColors: () => void;
    
    // Custom theme actions
    /** Save current customizations as a new custom theme */
    saveAsCustomTheme: (name: string) => CustomTheme;
    /** Save current color customizations to an existing custom theme */
    saveCustomTheme: (id: string) => void;
    /** Update an existing custom theme metadata (name only) */
    updateCustomTheme: (id: string, updates: { name?: string }) => void;
    /** Delete a custom theme */
    deleteCustomTheme: (id: string) => void;
    /** Get a custom theme by ID */
    getCustomTheme: (id: string) => CustomTheme | undefined;
    
    // General actions
    /** Reset to default theme */
    reset: () => void;
    /** Apply current theme to document */
    applyTheme: () => void;
    /** Mark as initialized */
    setInitialized: () => void;
}

/**
 * Load Google Font if needed
 */
function loadGoogleFont(fontId: string): void {
    if (typeof document === 'undefined') return;
    
    const fontUrl = getGoogleFontUrl(fontId);
    if (!fontUrl) return;
    
    // Check if font is already loaded
    const existingLink = document.querySelector(`link[href="${fontUrl}"]`);
    if (existingLink) return;
    
    // Create and append link element
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = fontUrl;
    document.head.appendChild(link);
}

/**
 * Get effective colors by merging preset with custom overrides
 */
function getEffectiveColors(
    presetId: string,
    mode: 'light' | 'dark',
    customColors: ModeColors,
    savedCustomThemes: CustomTheme[]
): ThemeColors {
    // Check if it's a custom theme
    if (isCustomThemeId(presetId)) {
        const customTheme = savedCustomThemes.find(t => t.id === presetId);
        if (customTheme) {
            // Get base preset colors
            const baseColors = getPresetColors(customTheme.basePresetId, mode);
            // Apply saved custom colors for this mode
            const savedColors = mode === 'light' ? customTheme.lightColors : customTheme.darkColors;
            // Apply current editing session overrides
            const sessionColors = mode === 'light' ? customColors.light : customColors.dark;
            return {
                ...baseColors,
                ...savedColors,
                ...sessionColors,
            };
        }
    }
    
    // Regular preset - get base colors and apply custom overrides
    const baseColors = getPresetColors(presetId, mode);
    const sessionColors = mode === 'light' ? customColors.light : customColors.dark;
    
    return {
        ...baseColors,
        ...sessionColors,
    };
}

export const useThemeStore = createStore<ThemeState>({
    key: 'theme-storage',
    label: 'Theme',
    creator: (set, get) => ({
        settings: defaultThemeSettings,
        initialized: false,
        
        setPreset: (presetId) => {
            set((state) => ({
                settings: { 
                    ...state.settings, 
                    presetId,
                    // Clear custom colors when switching presets
                    customColors: { light: null, dark: null },
                },
            }));
            get().applyTheme();
        },
        
        setMode: (mode) => {
            set((state) => ({
                settings: { ...state.settings, mode },
            }));
            get().applyTheme();
        },
        
        setFontFamily: (fontId) => {
            loadGoogleFont(fontId);
            set((state) => ({
                settings: { ...state.settings, fontFamily: fontId },
            }));
            get().applyTheme();
        },
        
        setCustomColor: (key, value) => {
            const { mode } = get().settings;
            set((state) => {
                const modeKey = mode === 'light' ? 'light' : 'dark';
                return {
                    settings: {
                        ...state.settings,
                        customColors: {
                            ...state.settings.customColors,
                            [modeKey]: {
                                ...state.settings.customColors[modeKey],
                                [key]: value,
                            },
                        },
                    },
                };
            });
            get().applyTheme();
        },
        
        resetCustomColors: () => {
            const { mode } = get().settings;
            set((state) => {
                const modeKey = mode === 'light' ? 'light' : 'dark';
                return {
                    settings: {
                        ...state.settings,
                        customColors: {
                            ...state.settings.customColors,
                            [modeKey]: null,
                        },
                    },
                };
            });
            get().applyTheme();
        },
        
        resetAllCustomColors: () => {
            set((state) => ({
                settings: {
                    ...state.settings,
                    customColors: { light: null, dark: null },
                },
            }));
            get().applyTheme();
        },
        
        saveAsCustomTheme: (name) => {
            const { settings } = get();
            const { presetId, customColors, savedCustomThemes } = settings;
            
            // Determine base preset (if already a custom theme, use its base)
            let basePresetId = presetId;
            let existingLightColors: Partial<ThemeColors> = {};
            let existingDarkColors: Partial<ThemeColors> = {};
            
            if (isCustomThemeId(presetId)) {
                const existingCustom = savedCustomThemes.find(t => t.id === presetId);
                if (existingCustom) {
                    basePresetId = existingCustom.basePresetId;
                    existingLightColors = existingCustom.lightColors;
                    existingDarkColors = existingCustom.darkColors;
                }
            }
            
            const newTheme: CustomTheme = {
                id: generateCustomThemeId(),
                name,
                basePresetId,
                lightColors: { ...existingLightColors, ...customColors.light },
                darkColors: { ...existingDarkColors, ...customColors.dark },
                createdAt: Date.now(),
            };
            
            set((state) => ({
                settings: {
                    ...state.settings,
                    savedCustomThemes: [...state.settings.savedCustomThemes, newTheme],
                    presetId: newTheme.id,
                    customColors: { light: null, dark: null },
                },
            }));
            
            get().applyTheme();
            return newTheme;
        },
        
        saveCustomTheme: (id) => {
            const { settings } = get();
            const { customColors, savedCustomThemes } = settings;
            
            // Find the existing custom theme
            const existingTheme = savedCustomThemes.find(t => t.id === id);
            if (!existingTheme) return;
            
            // Merge current session colors into the existing theme
            set((state) => ({
                settings: {
                    ...state.settings,
                    savedCustomThemes: state.settings.savedCustomThemes.map(theme =>
                        theme.id === id
                            ? {
                                ...theme,
                                lightColors: { ...theme.lightColors, ...customColors.light },
                                darkColors: { ...theme.darkColors, ...customColors.dark },
                            }
                            : theme
                    ),
                    // Clear session custom colors after saving
                    customColors: { light: null, dark: null },
                },
            }));
            
            get().applyTheme();
        },
        
        updateCustomTheme: (id, updates) => {
            set((state) => ({
                settings: {
                    ...state.settings,
                    savedCustomThemes: state.settings.savedCustomThemes.map(theme =>
                        theme.id === id ? { ...theme, ...updates } : theme
                    ),
                },
            }));
        },
        
        deleteCustomTheme: (id) => {
            const { settings } = get();
            
            set((state) => ({
                settings: {
                    ...state.settings,
                    savedCustomThemes: state.settings.savedCustomThemes.filter(t => t.id !== id),
                    // If deleting the current theme, switch to default
                    presetId: state.settings.presetId === id ? 'default' : state.settings.presetId,
                    customColors: state.settings.presetId === id 
                        ? { light: null, dark: null } 
                        : state.settings.customColors,
                },
            }));
            
            if (settings.presetId === id) {
                get().applyTheme();
            }
        },
        
        getCustomTheme: (id) => {
            return get().settings.savedCustomThemes.find(t => t.id === id);
        },
        
        reset: () => {
            set({ settings: defaultThemeSettings });
            get().applyTheme();
        },
        
        applyTheme: () => {
            const { settings } = get();
            const { presetId, mode, customColors, fontFamily, savedCustomThemes } = settings;
            
            // Get effective colors
            const colors = getEffectiveColors(presetId, mode, customColors, savedCustomThemes);
            
            // Apply to document
            applyThemeColors(colors);
            applyFontFamily(fontFamily);
            applyMode(mode);
            
            // Load Google Font if needed
            loadGoogleFont(fontFamily);
        },
        
        setInitialized: () => {
            set({ initialized: true });
        },
    }),
    persistOptions: {
        partialize: (state) => ({ settings: state.settings }),
        merge: (persistedState, currentState) => {
            const persisted = persistedState as { settings?: Partial<ThemeConfig> };
            return {
                ...currentState,
                settings: {
                    ...defaultThemeSettings,
                    ...persisted?.settings,
                    // Ensure customColors has correct structure
                    customColors: {
                        light: persisted?.settings?.customColors?.light ?? null,
                        dark: persisted?.settings?.customColors?.dark ?? null,
                    },
                    // Ensure savedCustomThemes is an array
                    savedCustomThemes: persisted?.settings?.savedCustomThemes ?? [],
                },
            };
        },
    },
});

/**
 * Hook to get current effective colors (preset + custom merged)
 */
export function useEffectiveColors(): ThemeColors {
    const settings = useThemeStore((s) => s.settings);
    const { presetId, mode, customColors, savedCustomThemes } = settings;
    return getEffectiveColors(presetId, mode, customColors, savedCustomThemes);
}

/**
 * Hook to check if custom colors are active for current mode
 */
export function useHasCustomColors(): boolean {
    const { customColors, mode } = useThemeStore((s) => s.settings);
    const modeColors = mode === 'light' ? customColors.light : customColors.dark;
    return modeColors !== null && Object.keys(modeColors).length > 0;
}

/**
 * Hook to check if any custom colors exist (either mode)
 */
export function useHasAnyCustomColors(): boolean {
    const { customColors } = useThemeStore((s) => s.settings);
    const hasLight = customColors.light !== null && Object.keys(customColors.light).length > 0;
    const hasDark = customColors.dark !== null && Object.keys(customColors.dark).length > 0;
    return hasLight || hasDark;
}

/**
 * Hook to get saved custom themes
 */
export function useSavedCustomThemes(): CustomTheme[] {
    return useThemeStore((s) => s.settings.savedCustomThemes);
}
