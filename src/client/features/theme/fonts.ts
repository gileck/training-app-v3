/**
 * Font Family Presets
 * 
 * Defines available font families for the theme system.
 */

import type { FontPreset } from './types';

/**
 * System fonts - no external loading required
 */
const systemFont: FontPreset = {
    id: 'system',
    name: 'System',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    description: 'Native system fonts for fastest loading',
};

/**
 * Inter - Clean, modern sans-serif
 */
const interFont: FontPreset = {
    id: 'inter',
    name: 'Inter',
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    googleFontUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    description: 'Clean and modern, great for UI',
};

/**
 * Plus Jakarta Sans - Friendly, rounded
 */
const plusJakartaFont: FontPreset = {
    id: 'plus-jakarta',
    name: 'Plus Jakarta Sans',
    fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    googleFontUrl: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap',
    description: 'Friendly and approachable',
};

/**
 * Space Grotesk - Technical, geometric
 */
const spaceGroteskFont: FontPreset = {
    id: 'space-grotesk',
    name: 'Space Grotesk',
    fontFamily: '"Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    googleFontUrl: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap',
    description: 'Technical and geometric',
};

/**
 * Libre Baskerville - Classic serif
 */
const libreBaskervilleFont: FontPreset = {
    id: 'libre-baskerville',
    name: 'Libre Baskerville',
    fontFamily: '"Libre Baskerville", Georgia, "Times New Roman", serif',
    googleFontUrl: 'https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&display=swap',
    description: 'Classic and elegant serif',
};

/**
 * JetBrains Mono - Monospace
 */
const jetBrainsMonoFont: FontPreset = {
    id: 'jetbrains-mono',
    name: 'JetBrains Mono',
    fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
    googleFontUrl: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap',
    description: 'Developer-friendly monospace',
};

/**
 * DM Sans - Geometric sans-serif
 */
const dmSansFont: FontPreset = {
    id: 'dm-sans',
    name: 'DM Sans',
    fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    googleFontUrl: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap',
    description: 'Low-contrast geometric sans',
};

/**
 * Outfit - Modern geometric
 */
const outfitFont: FontPreset = {
    id: 'outfit',
    name: 'Outfit',
    fontFamily: '"Outfit", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    googleFontUrl: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap',
    description: 'Modern and versatile',
};

/**
 * All available font presets
 */
export const fontPresets: FontPreset[] = [
    systemFont,
    interFont,
    plusJakartaFont,
    spaceGroteskFont,
    dmSansFont,
    outfitFont,
    libreBaskervilleFont,
    jetBrainsMonoFont,
];

/**
 * Get a font preset by ID
 */
export function getFontPreset(id: string): FontPreset | undefined {
    return fontPresets.find(preset => preset.id === id);
}

/**
 * Get the default font preset
 */
export function getDefaultFontPreset(): FontPreset {
    return systemFont;
}

/**
 * Get all Google Font URLs that need to be loaded for a given font ID
 */
export function getGoogleFontUrl(fontId: string): string | undefined {
    const preset = getFontPreset(fontId);
    return preset?.googleFontUrl;
}

/**
 * Get the CSS font-family value for a font ID
 */
export function getFontFamily(fontId: string): string {
    const preset = getFontPreset(fontId);
    return preset?.fontFamily ?? systemFont.fontFamily;
}

