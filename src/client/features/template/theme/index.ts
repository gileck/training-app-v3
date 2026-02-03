/**
 * Theme Feature
 * 
 * Public exports for the theme system.
 */

// Types
export type { 
    BaseThemeColors,
    ThemeColors, 
    ThemePreset, 
    FontPreset, 
    ThemeConfig,
    CustomTheme,
    ModeColors,
} from './types';
export { 
    colorToCssVar, 
    defaultThemeSettings,
    isCustomThemeId,
    generateCustomThemeId,
} from './types';

// Presets
export { themePresets, getThemePreset, getDefaultPreset, getPresetColors } from './presets';

// Fonts
export { fontPresets, getFontPreset, getDefaultFontPreset, getFontFamily, getGoogleFontUrl } from './fonts';

// Store
export { 
    useThemeStore, 
    useEffectiveColors, 
    useHasCustomColors,
    useHasAnyCustomColors,
    useSavedCustomThemes,
} from './store';

// Utils
export { 
    applyThemeColors, 
    applyFontFamily, 
    applyMode,
    hslToHex,
    hexToHsl,
    getPreviewStyle,
} from './utils';

// Components
export { ThemeSettings } from './ThemeSettings';
export { CustomThemeEditor } from './CustomThemeEditor';
export { ColorCustomizer } from './ColorCustomizer';
export { ColorEditorDialog } from './ColorEditorDialog';
