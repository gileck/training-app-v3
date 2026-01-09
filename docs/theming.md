# Theming System

This document describes the application's comprehensive theming system, which allows users to customize the look and feel of the entire application.

## Table of Contents

1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [CSS Variable Reference](#css-variable-reference)
4. [Using Themes in Components](#using-themes-in-components)
5. [Built-in Theme Presets](#built-in-theme-presets)
6. [Font System](#font-system)
7. [Adding New Theme Presets](#adding-new-theme-presets)
8. [Adding New Font Options](#adding-new-font-options)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The theming system provides:

- **8 Built-in Theme Presets**: Default, Ocean, Forest, Sunset, Rose, Midnight, Monochrome, Earth
- **Light/Dark Mode**: Each preset has both light and dark variants
- **Custom Color Overrides**: Users can customize primary, secondary, accent, and background colors
- **8 Font Families**: System, Inter, Plus Jakarta Sans, Space Grotesk, DM Sans, Outfit, Libre Baskerville, JetBrains Mono
- **Persistent Settings**: Theme preferences are saved to localStorage
- **Live Preview**: Changes apply instantly across the entire app

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Theme System                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐                                                    │
│  │   useThemeStore     │  ← Zustand store (persisted to localStorage)       │
│  │   - presetId        │                                                    │
│  │   - customColors    │                                                    │
│  │   - fontFamily      │                                                    │
│  │   - mode (light/dark)│                                                   │
│  └──────────┬──────────┘                                                    │
│             │                                                                │
│             ▼                                                                │
│  ┌─────────────────────┐                                                    │
│  │   ThemeProvider     │  ← Applies CSS variables to document.documentElement │
│  │   (in _app.tsx)     │                                                    │
│  └──────────┬──────────┘                                                    │
│             │                                                                │
│             ▼                                                                │
│  ┌─────────────────────┐                                                    │
│  │   CSS Variables     │  ← --primary, --background, --font-sans, etc.     │
│  │   (on :root)        │                                                    │
│  └──────────┬──────────┘                                                    │
│             │                                                                │
│             ▼                                                                │
│  ┌─────────────────────┐                                                    │
│  │   All Components    │  ← Use semantic Tailwind classes (bg-primary, etc.)│
│  └─────────────────────┘                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

1. **User selects theme** in Settings → Theme store updates
2. **ThemeProvider** reads store and applies CSS variables to `:root`
3. **All components** use semantic Tailwind classes that reference CSS variables
4. **Entire app updates** instantly with no page reload

---

## CSS Variable Reference

### Color Variables

| Variable | Tailwind Class | Usage |
|----------|---------------|-------|
| `--background` | `bg-background` | Main page background |
| `--foreground` | `text-foreground` | Primary text color |
| `--card` | `bg-card` | Card/panel backgrounds |
| `--card-foreground` | `text-card-foreground` | Text on cards |
| `--popover` | `bg-popover` | Dropdown/modal backgrounds |
| `--popover-foreground` | `text-popover-foreground` | Text in popovers |
| `--muted` | `bg-muted` | Subtle backgrounds |
| `--muted-foreground` | `text-muted-foreground` | Secondary text |
| `--primary` | `bg-primary`, `text-primary` | Primary actions |
| `--primary-foreground` | `text-primary-foreground` | Text on primary bg |
| `--secondary` | `bg-secondary`, `text-secondary` | Secondary actions |
| `--secondary-foreground` | `text-secondary-foreground` | Text on secondary bg |
| `--accent` | `bg-accent` | Highlighted items |
| `--accent-foreground` | `text-accent-foreground` | Text on accent bg |
| `--destructive` | `bg-destructive`, `text-destructive` | Error/danger states |
| `--destructive-foreground` | `text-destructive-foreground` | Text on destructive bg |
| `--border` | `border-border` | Default borders |
| `--input` | `border-input` | Form input borders |
| `--ring` | `ring-ring` | Focus ring color |
| `--success` | (custom) | Success states |
| `--warning` | (custom) | Warning states |

### Layout Variables

| Variable | Usage |
|----------|-------|
| `--header` | Header/top navigation background color |
| `--header-foreground` | Text color in header |
| `--footer` | Footer/bottom navigation background color |
| `--footer-foreground` | Text color in footer |

> **Note:** Header and footer use inline styles with CSS variables (e.g., `style={{ backgroundColor: 'hsl(var(--header))' }}`) rather than Tailwind classes to ensure proper reactivity when theme colors change.

### Font Variable

| Variable | Tailwind Class | Usage |
|----------|---------------|-------|
| `--font-sans` | `font-sans` | Main font family |

### Default Values (Light Mode)

```css
:root {
    --background: 210 20% 98%;
    --foreground: 222 47% 11%;
    --primary: 221 83% 53%;
    --secondary: 262 83% 58%;
    /* ... etc */
}
```

### Dark Mode Values

```css
.dark {
    --background: 222 47% 6%;
    --foreground: 210 40% 96%;
    --primary: 217 91% 60%;
    --secondary: 263 89% 67%;
    /* ... etc */
}
```

---

## Using Themes in Components

### Basic Usage

Always use semantic Tailwind classes:

```tsx
// ✅ CORRECT
<div className="bg-background text-foreground">
  <Card className="bg-card border-border">
    <h2 className="text-foreground">Title</h2>
    <p className="text-muted-foreground">Description</p>
    <Button className="bg-primary text-primary-foreground">Action</Button>
  </Card>
</div>

// ❌ WRONG - breaks theming
<div className="bg-white dark:bg-slate-900 text-black dark:text-white">
  <div className="bg-gray-100 border-gray-200">
    <h2 className="text-slate-900">Title</h2>
    <button className="bg-blue-500 text-white">Action</button>
  </div>
</div>
```

### Using Status Colors

For success and warning colors, use the CSS variables directly:

```tsx
// Success indicator
<div className="text-success">
  <CheckIcon className="h-4 w-4" style={{ color: 'hsl(var(--success))' }} />
  Success!
</div>

// Warning badge
<span 
  className="rounded px-2 py-1 text-xs"
  style={{ 
    backgroundColor: 'hsl(var(--warning) / 0.2)', 
    color: 'hsl(var(--warning))' 
  }}
>
  Warning
</span>
```

### Accessing Theme in Code

```tsx
import { useThemeStore, useEffectiveColors, type ThemeConfig } from '@/client/features/theme';

function MyComponent() {
  // Get current settings (ThemeConfig type)
  const mode = useThemeStore((s) => s.settings.mode);
  const presetId = useThemeStore((s) => s.settings.presetId);
  
  // Get computed colors (preset + custom overrides merged)
  const colors = useEffectiveColors();
  
  // Change theme
  const setMode = useThemeStore((s) => s.setMode);
  const setPreset = useThemeStore((s) => s.setPreset);
  
  return (
    <button onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}>
      Toggle {mode === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
```

---

## Built-in Theme Presets

| ID | Name | Description | Primary Color |
|----|------|-------------|---------------|
| `default` | Default | Clean blue and violet accents | Blue |
| `ocean` | Ocean | Calming teal and cyan | Teal |
| `forest` | Forest | Natural greens and earthy tones | Green |
| `sunset` | Sunset | Warm oranges and golden tones | Orange |
| `rose` | Rose | Soft pinks and rose accents | Pink |
| `midnight` | Midnight | Deep purples and rich indigo | Purple |
| `monochrome` | Monochrome | Clean and minimal grayscale | Gray |
| `earth` | Earth | Warm browns and terracotta tones | Brown |

Each preset defines colors for both light and dark modes.

---

## Font System

### Available Fonts

| ID | Name | Type | Loading |
|----|------|------|---------|
| `system` | System | Sans-serif | None (native) |
| `inter` | Inter | Sans-serif | Google Fonts |
| `plus-jakarta` | Plus Jakarta Sans | Sans-serif | Google Fonts |
| `space-grotesk` | Space Grotesk | Sans-serif | Google Fonts |
| `dm-sans` | DM Sans | Sans-serif | Google Fonts |
| `outfit` | Outfit | Sans-serif | Google Fonts |
| `libre-baskerville` | Libre Baskerville | Serif | Google Fonts |
| `jetbrains-mono` | JetBrains Mono | Monospace | Google Fonts |

### Font Loading

Google Fonts are loaded dynamically when selected. The system font requires no external loading.

### Using Custom Fonts

The font is applied via the `--font-sans` CSS variable. The body element inherits this automatically. For explicit usage:

```tsx
<div className="font-sans">
  This text uses the selected font
</div>
```

---

## Adding New Theme Presets

1. Open `src/client/features/theme/presets.ts`

2. Add a new `ThemePreset` object:

```typescript
const myTheme: ThemePreset = {
    id: 'my-theme',
    name: 'My Theme',
    description: 'A custom theme description',
    light: {
        background: '210 20% 98%',
        foreground: '222 47% 11%',
        primary: '180 70% 45%',  // Your primary color (HSL)
        // ... all other colors
    },
    dark: {
        background: '222 47% 6%',
        foreground: '210 40% 96%',
        primary: '180 70% 55%',
        // ... all other colors
    },
};
```

3. Add to the `themePresets` array:

```typescript
export const themePresets: ThemePreset[] = [
    defaultTheme,
    oceanTheme,
    // ... existing themes
    myTheme,  // Add your theme
];
```

4. The theme will automatically appear in the Settings UI.

### HSL Color Format

Colors are stored as HSL values **without the `hsl()` wrapper**:
- Format: `"hue saturation% lightness%"`
- Example: `"221 83% 53%"` (blue)

Use tools like [HSL Color Picker](https://hslpicker.com/) to find values.

---

## Adding New Font Options

1. Open `src/client/features/theme/fonts.ts`

2. Add a new `FontPreset` object:

```typescript
const myFont: FontPreset = {
    id: 'my-font',
    name: 'My Font',
    fontFamily: '"My Font", -apple-system, BlinkMacSystemFont, sans-serif',
    googleFontUrl: 'https://fonts.googleapis.com/css2?family=My+Font:wght@400;500;600;700&display=swap',
    description: 'A description of the font',
};
```

3. Add to the `fontPresets` array:

```typescript
export const fontPresets: FontPreset[] = [
    systemFont,
    interFont,
    // ... existing fonts
    myFont,  // Add your font
];
```

4. The font will automatically appear in the Settings UI.

---

## Best Practices

### Do's ✅

1. **Always use semantic color tokens** (`bg-primary`, `text-foreground`, etc.)
2. **Test with multiple theme presets** (at least Default and Monochrome)
3. **Test in both light and dark modes**
4. **Use the `Card` component** for content containers
5. **Use shadcn/ui Button variants** (`default`, `secondary`, `outline`, `ghost`, `destructive`)

### Don'ts ❌

1. **Never use hardcoded colors** (`bg-white`, `text-black`, `bg-blue-500`)
   - **Exception**: Dialog/modal overlays may use `bg-black/60` (standard shadcn/ui pattern for backdrop opacity)
2. **Never use hex colors directly** (`#3b82f6`, `#ffffff`)
3. **Don't create new color variables** without adding them to the theme system
4. **Don't use `dark:` variants** for colors (the theme system handles this)

### Component Checklist

When creating or modifying components:

- [ ] All backgrounds use semantic tokens (`bg-background`, `bg-card`, `bg-muted`)
- [ ] All text uses semantic tokens (`text-foreground`, `text-muted-foreground`)
- [ ] All borders use `border-border` or `border-input`
- [ ] Focus states use `ring-ring`
- [ ] Tested with at least 2 different theme presets
- [ ] Tested in both light and dark modes
- [ ] All text is readable against its background

---

## Troubleshooting

### Theme Not Applying

1. Check that `ThemeProvider` is wrapping your app in `_app.tsx`
2. Verify the component uses semantic Tailwind classes
3. Check browser console for errors
4. Clear localStorage and refresh

### Colors Look Wrong

1. Verify you're using HSL format without the wrapper (`"221 83% 53%"` not `"hsl(221, 83%, 53%)"`)
2. Check that all required color keys are defined in your preset
3. Ensure the preset is added to the `themePresets` array

### Font Not Loading

1. Check browser Network tab for failed font requests
2. Verify the Google Fonts URL is correct
3. Check for CORS issues if using custom font hosting

### Custom Colors Not Persisting

1. Check localStorage for `theme-storage` key
2. Verify the store is using `createStore` from `@/client/stores`
3. Clear localStorage and try again

---

## Related Files

### Feature Implementation
- `src/client/features/theme/types.ts` - Type definitions
- `src/client/features/theme/presets.ts` - Theme preset definitions
- `src/client/features/theme/fonts.ts` - Font preset definitions
- `src/client/features/theme/store.ts` - Zustand store
- `src/client/features/theme/utils.ts` - Color utilities
- `src/client/features/theme/ThemeSettings.tsx` - Settings UI

### Integration Points
- `src/client/components/ThemeProvider.tsx` - Applies theme to document
- `src/client/styles/globals.css` - CSS variable definitions
- `src/client/routes/Settings/Settings.tsx` - Settings page integration

### Guidelines
- `.cursor/rules/theming-guidelines.mdc` - AI/developer coding guidelines

