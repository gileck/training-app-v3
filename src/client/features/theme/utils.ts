/**
 * Theme Utility Functions
 * 
 * Helpers for color manipulation and theme application.
 */

import type { ThemeColors } from './types';
import { colorToCssVar } from './types';
import { getFontFamily } from './fonts';

/**
 * Apply theme colors to the document root as CSS custom properties
 */
export function applyThemeColors(colors: ThemeColors): void {
    if (typeof document === 'undefined') return;
    
    const root = document.documentElement;
    
    // Apply each color as a CSS variable
    (Object.keys(colors) as (keyof ThemeColors)[]).forEach((key) => {
        const cssVar = colorToCssVar[key];
        if (cssVar) {
            root.style.setProperty(cssVar, colors[key]);
        }
    });
}

/**
 * Apply font family to the document root
 */
export function applyFontFamily(fontId: string): void {
    if (typeof document === 'undefined') return;
    
    const fontFamily = getFontFamily(fontId);
    document.documentElement.style.setProperty('--font-sans', fontFamily);
}

/**
 * Apply dark/light mode class to document
 */
export function applyMode(mode: 'light' | 'dark'): void {
    if (typeof document === 'undefined') return;
    
    const root = document.documentElement;
    if (mode === 'dark') {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
}

/**
 * Convert HSL string to hex color for color picker
 * Input: "221 83% 53%" (HSL without wrapper)
 * Output: "#3b82f6" (hex)
 */
export function hslToHex(hslString: string): string {
    const [h, s, l] = hslString.split(' ').map((v, i) => {
        if (i === 0) return parseFloat(v);
        return parseFloat(v.replace('%', '')) / 100;
    });
    
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    
    return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Convert hex color to HSL string for storage
 * Input: "#3b82f6" (hex)
 * Output: "221 83% 53%" (HSL without wrapper)
 */
export function hexToHsl(hex: string): string {
    // Remove # if present
    const cleanHex = hex.replace('#', '');
    
    // Parse RGB values
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    
    let h = 0;
    let s = 0;
    
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                break;
            case g:
                h = ((b - r) / d + 2) / 6;
                break;
            case b:
                h = ((r - g) / d + 4) / 6;
                break;
        }
    }
    
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Create a preview-friendly CSS string from colors
 */
export function getPreviewStyle(colors: ThemeColors): Record<string, string> {
    const style: Record<string, string> = {};
    
    (Object.keys(colors) as (keyof ThemeColors)[]).forEach((key) => {
        const cssVar = colorToCssVar[key];
        if (cssVar) {
            style[cssVar] = colors[key];
        }
    });
    
    return style;
}

