---
title: iOS-Inspired UI Design Guidelines
description: Design philosophy and iOS-inspired principles for UI components. Use this for understanding design patterns, advanced concepts (RTL, haptics, animations), and QA checklists.
summary: "iOS-inspired design reference with semantic color tokens, 8px spacing grid, 44px touch targets, spring animations, dark mode handling, accessibility standards, and comprehensive QA checklists. Code examples use raw CSS/HTML — adapt to shadcn + Tailwind patterns when implementing."
priority: 4
---
# iOS-Inspired UI Design Guidelines

> **Role**: Design PHILOSOPHY and inspiration reference. Contains iOS-inspired principles, advanced concepts (RTL, haptics, animations), and comprehensive QA checklists.
>
> **When to use**: Understanding WHY certain patterns exist, exploring advanced concepts not covered elsewhere, design inspiration.
>
> **Related skills**:
> - `ui-mobile-first-shadcn` - AUTHORITATIVE implementation rules. Use that skill for actual code patterns.
> - `web-design-guidelines` - On-demand audit tool for code reviews.
>
> **Important**: Code examples here use raw CSS/HTML. When implementing, adapt to shadcn + Tailwind patterns from `ui-mobile-first-shadcn`. Do NOT use raw hex colors in components - use semantic tokens instead.

## Color Palette & Theme

### Dynamic System Colors
- Use iOS dynamic semantic colors that adapt to system preferences
- Map semantic tokens to system colors when on iOS: `--color-accent → UIColor.systemBlue`
- Implement auto-switching via `@supports (-webkit-touch-callout: none)` for iOS detection
- Export colors as design tokens in `design-tokens.json` for cross-platform consistency

### Primary Colors
- Use vibrant, saturated colors as primary accent colors
- Implement iOS-style color schemes with bright blues (#007AFF), greens (#34C759), oranges (#FF9500)
- Support both light and dark mode with appropriate color adaptations
- Use semantic color naming (primary, secondary, success, warning, error)

### Color Usage
- Apply 60-30-10 color rule: 60% neutral background, 30% secondary color, 10% accent color
- Use color psychology: blue for trust/productivity, green for success/health, orange for energy/creativity
- Implement gradient backgrounds and subtle color transitions
- Ensure WCAG AA contrast ratios (4.5:1 for normal text, 3:1 for large text)
- Maintain 3:1 contrast ratio for non-text elements (icons, borders, focus indicators)

### Dark/Light Mode Implementation
- Implement user-controlled theme toggle with persistent storage using `next-themes`
- Use HTML `.dark` class for dark mode switching (shadcn + next-themes pattern)
- Store theme preference in app settings with localStorage persistence
- Provide theme toggle button in header navigation with appropriate icons
- Ensure proper SSR handling with client-side theme initialization
- Apply semantic color tokens from `globals.css` for theme-aware colors

### Theme Provider Architecture
```tsx
// ThemeProvider implementation using next-themes
import { ThemeProvider } from 'next-themes';

export const AppThemeProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  );
};

// Theme toggle implementation
import { useTheme } from 'next-themes';

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  
  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };
  
  return (
    <Button variant="ghost" size="icon" onClick={toggleTheme}>
      {theme === 'light' ? <Moon /> : <Sun />}
    </Button>
  );
};
```

### Accessibility Color Support
- Honor user-selected tint in iOS Settings → Accessibility → Display → Button Shapes
- Add underline to primary buttons when accessibility button shapes are detected
- Support high contrast mode with enhanced color differentiation

## Layout & Spacing

### Grid System
- Use 8px base unit system for consistent spacing (iOS uses multiples of 4pt)
- Implement responsive 12-column grid layout
- Use CSS Grid for complex layouts, Flexbox for component-level layouts
- Stick to 4pt/8px multiples for all spacing - avoid golden ratio to maintain iOS consistency

### Spacing Scale
```css
--spacing-xs: 4px;    /* 0.5 units */
--spacing-sm: 8px;    /* 1 unit */
--spacing-md: 16px;   /* 2 units */
--spacing-lg: 24px;   /* 3 units */
--spacing-xl: 32px;   /* 4 units */
--spacing-2xl: 48px;  /* 6 units */
--spacing-3xl: 64px;  /* 8 units */
```

### Margins & Padding
- Use consistent padding: `16px` for cards, `24px` for containers, `8px` for buttons
- Apply breathing room with `margin-bottom: 24px` between major sections
- Use horizontal padding of `20px` for mobile-first design
- Implement safe area insets for ALL fixed headers/footers: `padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)`
- Apply safe areas to navigation, modals, and floating action buttons

## Typography

### Font Hierarchy
- Use system fonts: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- Implement clear type scale:
  - H1: 32px (2rem) - Page titles
  - H2: 24px (1.5rem) - Section headers
  - H3: 20px (1.25rem) - Subsection headers
  - Body: 16px (1rem) - Regular text
  - Caption: 14px (0.875rem) - Secondary text
  - Small: 12px (0.75rem) - Labels and metadata

### Text Styling
- Use `font-weight: 500` (medium) for navigation titles, `600` for headers, `400` for body text
- Apply `line-height: 1.5` for optimal readability
- Map CSS variables to iOS Dynamic Type categories (Body, Headline, LargeTitle) when on iOS
- Implement true dynamic type scaling that grows more than web `clamp()` values
- Use sentence case for UI elements (not ALL CAPS)

## Components & Elements

### Buttons
- Rounded corners: `border-radius: 12px` for primary buttons, `8px` for secondary
- Minimum touch target: `44px x 44px` (iOS HIG requirement)
- Button hierarchy: Filled (primary), Outlined (secondary), Text (tertiary)
- Use drop shadows for depth: `box-shadow: 0 2px 8px rgba(0,0,0,0.1)`
- Apply smooth transitions: `transition: all 0.2s ease-in-out`

### Cards & Containers
- Rounded corners: `border-radius: 16px` for cards, `12px` for smaller elements
- Ultra-subtle iOS shadows: `box-shadow: 0 1px 3px rgba(0,0,0,0.12)` light, `0 1px 3px rgba(0,0,0,0.72)` dark
- Background blur effects for overlays: `backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px)`
- Avoid backdrop-filter on surfaces > 75% viewport for GPU performance
- Border usage: `1px solid rgba(0,0,0,0.1)` for light mode, `rgba(255,255,255,0.1)` for dark mode

### Lists & Data Display
- Use alternating row colors for large data sets
- Apply hover states: `background-color: rgba(0,0,0,0.04)`
- Consistent list item padding: `16px vertical, 20px horizontal`
- Use dividers sparingly: `1px solid rgba(0,0,0,0.08)`
- Implement swipe actions for mobile interactions

### Headers & Navigation
- Sticky headers with blur background: `backdrop-filter: blur(20px)`
- Large title style: `font-size: 34px, font-weight: 700`
- Navigation bar height: `44px` minimum
- Use breadcrumbs for deep navigation
- Implement smooth scroll-based header animations

## Interactive Elements

### Animations & Transitions
- Use iOS-style spring animations: `cubic-bezier(0.25, 0.8, 0.25, 1.1)`
- Apply subtle micro-interactions on hover/focus
- Implement loading states with skeleton screens
- Use transform animations over property changes for performance
- Duration tokens: `--duration-fast: 120ms`, `--duration-medium: 200ms`, `--duration-slow: 320ms`
- Page transitions: 240-300ms fade/slide with `content-visibility: hidden` during exit

### States & Feedback
- Hover (pointer devices): Slight scale (`transform: scale(1.02)`) only when `@media (hover: hover)`
- Touch devices: Use opacity (`0.9`) instead of scale to prevent layout jank
- Active: Scale down (`transform: scale(0.97)`) for ≤80ms then spring back
- Focus: Prominent outline with brand color for keyboard navigation
- Disabled: `opacity: 0.6` with `cursor: not-allowed`
- Loading: Smooth spinner or progress indicators

### Haptic Feedback (PWA/Native)
- Add haptic feedback for critical interactions using Capacitor or native APIs
- Use `UIImpactFeedbackStyle.Medium` for button presses
- Implement `UIImpactFeedbackStyle.Light` for selection changes

## Responsive Design

### Breakpoints
```css
--mobile: 320px;
--tablet: 768px;
--desktop: 1024px;  /* Note: iPhone 15 Pro Max landscape is 932px */
--large: 1280px;
```

### Mobile-First Approach
- Start with mobile layout, enhance for larger screens
- Use `clamp()` for fluid typography: `clamp(16px, 4vw, 20px)`
- Implement touch-friendly interfaces with adequate spacing
- Use bottom navigation for mobile, top navigation for desktop
- Test header/navigation behavior around 930px (large phone landscape)

## Accessibility & Usability

### Accessibility Standards
- Maintain proper heading hierarchy (h1 → h2 → h3)
- Use semantic HTML landmarks: `<header role="banner">`, `<nav role="navigation">`, `<main role="main">`, `<footer role="contentinfo">`
- Provide alt text for images and aria-labels for interactive elements
- Add `aria-describedby` links between form fields and helper text
- Ensure keyboard navigation works throughout the app with visible focus indicators
- Support reduced motion preferences: replace transforms with opacity fades ≤120ms
- Include VoiceOver rotor support with proper landmark regions

### Performance Considerations
- Use CSS custom properties for theme switching
- Implement efficient CSS selectors
- Minimize layout shifts with explicit dimensions
- Use `will-change` property sparingly for animations
- Gate heavy, off-screen UI behind `content-visibility: auto` and `contain-intrinsic-size`
- Add `fetchpriority="high"` to hero images and `loading="lazy"` everywhere else
- Avoid `backdrop-filter` on huge full-screen elements (GPU memory impact)

### Theme Implementation Best Practices
- Use a single ThemeProvider (next-themes) at the root level
- Rely on semantic color tokens from `globals.css` that adapt automatically
- Use shadcn components that automatically adapt to theme changes
- Implement proper SSR handling: `suppressHydrationWarning` on html element
- Place theme toggle in header navigation for consistent access across all pages
- Use semantic theme naming ('light'/'dark'/'system')

## Implementation Examples

### Design Token System
```css
:root {
  /* Colors - Dynamic System Support */
  --color-primary: #007AFF;
  --color-secondary: #5856D6;
  --color-success: #34C759;
  --color-warning: #FF9500;
  --color-error: #FF3B30;
  
  /* iOS Detection Override */
  @supports (-webkit-touch-callout: none) {
    --color-primary: var(--ios-system-blue, #007AFF);
    --color-background: var(--ios-system-background, #FFFFFF);
  }
  
  /* Spacing */
  --spacing-base: 8px;
  
  /* Borders */
  --border-radius-sm: 8px;
  --border-radius-md: 12px;
  --border-radius-lg: 16px;
  
  /* Depth - iOS-optimized shadows */
  --shadow-xs: 0 1px 3px rgba(0,0,0,0.12);
  --shadow-sm: 0 2px 6px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.06);
  
  /* Motion */
  --ease-spring: cubic-bezier(0.25, 0.8, 0.25, 1.1);
  --duration-fast: 120ms;
  --duration-medium: 200ms;
  --duration-slow: 320ms;
}

/* Dark mode shadows */
@media (prefers-color-scheme: dark) {
  :root {
    --shadow-xs: 0 1px 3px rgba(0,0,0,0.72);
    --shadow-sm: 0 2px 6px rgba(0,0,0,0.64);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.56);
  }
}
```

### shadcn Component Usage
When using shadcn components, follow these patterns:

```tsx
// Button variants and sizes
import { Button } from '@/client/components/ui/button';

<Button variant="default">Primary Action</Button>
<Button variant="outline">Secondary</Button>
<Button variant="ghost">Tertiary</Button>
<Button variant="destructive">Delete</Button>
<Button size="sm">Small</Button>
<Button size="icon"><Icon /></Button>

// Cards with proper styling
import { Card, CardHeader, CardTitle, CardContent } from '@/client/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Card content goes here</p>
  </CardContent>
</Card>

// Form elements with labels
import { Input } from '@/client/components/ui/input';
import { Label } from '@/client/components/ui/label';

<div className="grid gap-2">
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" placeholder="Enter email" />
</div>
```

### Component Structure
When creating UI components in [client/components](mdc:src/client/components), follow these patterns:
- Use shadcn/ui primitives from `@/client/components/ui/*`
- Use TypeScript interfaces for all props
- Implement consistent className patterns with Tailwind utilities
- Apply proper ARIA attributes
- Include loading and error states
- Support theme switching via semantic color tokens

### Common Theme Implementation Issues & Solutions

#### Problem: Theme Not Persisting
**Issue**: Theme resets on page reload
**Solution**: Ensure ThemeProvider has proper storage enabled and SSR configuration

#### Problem: SSR Theme Mismatch
**Issue**: Server renders with default theme, client hydrates with user preference
**Solution**: Add `suppressHydrationWarning` to `<html>` element and use `next-themes`

#### Problem: Theme Toggle Not Visible
**Issue**: Theme toggle not accessible when user is logged out
**Solution**: Place toggle in main layout header, not inside authentication-gated components

#### Problem: Colors Not Adapting
**Issue**: Components don't change colors in dark mode
**Solution**: Use semantic tokens (`bg-background`, `text-foreground`) instead of hardcoded colors

```tsx
// ❌ Wrong - Multiple providers or conflicting CSS
<ThemeProvider theme={hardcodedTheme}>
  <AppThemeProvider>
    <App />
  </AppThemeProvider>
</ThemeProvider>

// ✅ Correct - Single provider with next-themes
<ThemeProvider attribute="class" defaultTheme="system">
  <App />
</ThemeProvider>
```

## Card Components with Images & Actions

### Image Card Layout
- **Image Container**: Fixed aspect ratio with overflow hidden
- **Image Placeholder**: Gradient background with scale animation on hover
- **Overlay Elements**: Badges and actions positioned absolutely
- **Content Area**: Structured with title, description, and metadata
- **Action Section**: Primary action takes full width, secondary actions as icons

### Card Patterns
```html
<!-- Standard Image Card -->
<div class="card card-image">
  <div class="card-image-container">
    <img src="image.jpg" alt="Description" class="card-image">
    <div class="card-image-overlay">
      <span class="badge badge-overlay">Featured</span>
    </div>
  </div>
  <div class="card-content">
    <h3>Card Title</h3>
    <p>Card description...</p>
    <div class="card-meta">
      <span class="card-price">$129</span>
      <span class="card-rating">⭐ 4.8</span>
    </div>
  </div>
  <div class="card-actions">
    <button class="btn-primary">Primary Action</button>
    <button class="btn-text">❤️</button>
    <button class="btn-text">📤</button>
  </div>
</div>

<!-- Horizontal Card Layout -->
<div class="card card-image card-horizontal">
  <div class="card-image-container">
    <img src="image.jpg" alt="Description" class="card-image">
  </div>
  <div class="card-content">
    <h3>Card Title</h3>
    <p>Description...</p>
    <div class="card-actions">
      <button class="btn-primary btn-sm">Action</button>
    </div>
  </div>
</div>
```

### Card Design Principles
- **Image Aspect Ratio**: Maintain consistent 16:9 or 4:3 ratios
- **Hover Effects**: Subtle scale animation on image (1.05x)
- **Metadata Display**: Price/rating information in structured layout
- **Action Hierarchy**: Primary action prominent, secondary actions as icons
- **Responsive Behavior**: Stack horizontally on mobile devices

## Enhanced Lists with Images & Actions

### Avatar and Thumbnail Components
- **User Avatars**: Circular containers for profile images or initials
- **Content Thumbnails**: Rounded square containers for media previews
- **Consistent Sizing**: 48px standard size for optimal touch targets
- **Gradient Backgrounds**: For placeholder states and initials

### List Item Patterns
```html
<!-- User Activity List -->
<div class="list-item list-item-enhanced">
  <div class="list-item-avatar">
    <div class="avatar avatar-image">👤</div>
  </div>
  <div class="list-item-content">
    <div class="list-item-title">User Name</div>
    <div class="list-item-subtitle">Action description</div>
    <div class="list-item-meta">
      <span>2 minutes ago</span>
    </div>
  </div>
  <div class="list-item-actions">
    <button class="btn-secondary btn-sm">Action</button>
    <button class="list-action-btn">⋯</button>
  </div>
</div>

<!-- Content Recommendation List -->
<div class="list-item list-item-enhanced">
  <div class="list-item-avatar">
    <div class="content-thumbnail">📚</div>
  </div>
  <div class="list-item-content">
    <div class="list-item-title">Content Title</div>
    <div class="list-item-subtitle">Content description</div>
    <div class="list-item-meta">
      <span class="badge badge-sm">Category</span>
      <span>Additional info</span>
    </div>
  </div>
  <div class="list-item-actions">
    <button class="btn-primary btn-sm">Primary</button>
    <button class="list-action-btn">❤️</button>
  </div>
</div>
```

### List Design Principles
- **Three-Column Layout**: Avatar/thumbnail, content, actions
- **Flexible Content**: Title, subtitle, and metadata structure
- **Action Hierarchy**: Primary button + icon actions
- **Visual Grouping**: Related content grouped with proper spacing
- **Touch Optimization**: 48px minimum touch targets for all interactive elements

### Implementation Guidelines
- Use semantic HTML structure with proper heading hierarchy
- Implement proper ARIA labels for accessibility
- Ensure keyboard navigation works for all interactive elements
- Apply consistent spacing using the 8px grid system
- Include hover and focus states for all interactive components

## Advanced Implementation Guidelines

### State Utility Classes
```css
/* Utility classes for consistent state management */
.is-loading {
  opacity: 0.6;
  pointer-events: none;
  cursor: default;
}

.is-disabled {
  opacity: 0.6;
  pointer-events: none;
  cursor: not-allowed;
}

.is-active {
  transform: scale(0.97);
}

.is-hover {
  transform: translateY(-1px);
}

/* Screen reader only content */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

## Dark Mode Imagery & Assets

### Image Handling in Dark Mode
- **Icons & Line Art**: Provide dual SVGs or use `currentColor` for automatic adaptation
- **Photographic Content**: Apply `--image-dm-overlay: rgba(0,0,0,.35)` with `mix-blend-mode: luminosity`
- **Illustrations**: Use muted palette and avoid pure-white fills
- **Brand Assets**: Provide dark mode variants for logos and brand elements

### Implementation Example
```css
.image-adaptive {
  transition: filter var(--duration-medium);
}

@media (prefers-color-scheme: dark) {
  .image-photo {
    filter: brightness(0.8) contrast(1.1);
    mix-blend-mode: luminosity;
  }
  
  .image-illustration {
    filter: brightness(0.9);
  }
}
```

## Keyboard Navigation & Shortcuts (iPad-first)

### Keyboard Support
- **Command Shortcuts**: Provide ⌘ + number shortcuts for tab/navigation
- **Focus Management**: Highlight focus ring with `outline: 2px solid var(--color-accent)`
- **Pointer Detection**: Show hover states only when `@media (pointer: fine)` matches
- **Focus Trapping**: Implement focus trapping in modals and dialogs

### Implementation
```css
/* Focus states for keyboard navigation */
.btn:focus-visible,
.list-item:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Hover states only for pointer devices */
@media (hover: hover) and (pointer: fine) {
  .btn:hover {
    transform: translateY(-1px);
  }
}
```

## Internationalization & RTL Support

### Layout Mirroring
- **Logical Properties**: Use `margin-inline-start/end` instead of `left/right`
- **Icon Mirroring**: Auto-flip chevrons/arrows with `transform: scaleX(-1)` in `[dir="rtl"]`
- **Number Formatting**: Use `Intl.NumberFormat` for proper numeral display
- **Text Expansion**: Test with 30% longer text for translated content

### Implementation Example
```css
.card {
  margin-inline-end: var(--spacing-md);
  padding-inline: var(--spacing-lg);
}

[dir="rtl"] .chevron-right {
  transform: scaleX(-1);
}

.price {
  text-align: end; /* Works for both LTR and RTL */
}
```

## Performance Optimization

### Content Visibility
```css
/* Gate heavy off-screen content */
.expensive-component {
  content-visibility: auto;
  contain-intrinsic-size: 200px;
}

/* Optimize images */
.hero-image {
  fetchpriority: "high";
}

.lazy-image {
  loading: "lazy";
}
```

### Motion Reduction
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  
  /* Replace transforms with opacity */
  .btn:hover {
    opacity: 0.9;
    transform: none;
  }
}
```

## Quality Assurance Checklist

### Color & Contrast Testing
- [ ] WCAG AA contrast ratio (4.5:1) for normal text
- [ ] WCAG AA contrast ratio (3:1) for large text and non-text elements
- [ ] Color blindness simulation testing
- [ ] High contrast mode compatibility

### Touch & Interaction Testing
- [ ] Minimum 44×44px touch targets on small screens
- [ ] Hover states only appear on pointer devices
- [ ] Focus indicators visible for keyboard navigation
- [ ] Haptic feedback implemented for critical actions (PWA/native)

### Accessibility Testing
- [ ] VoiceOver rotor navigation with landmarks
- [ ] Keyboard navigation reaches all interactive elements
- [ ] Screen reader announces state changes
- [ ] Form fields linked to helper text with `aria-describedby`

### Responsive & Layout Testing
- [ ] Layout works from 320px to 1280px+ viewport widths
- [ ] Navigation adapts properly around 930px (large phone landscape)
- [ ] Safe area insets applied to fixed headers/footers
- [ ] Content remains readable with 200% zoom

### Performance Testing
- [ ] `content-visibility` applied to heavy off-screen content
- [ ] `backdrop-filter` avoided on large surfaces
- [ ] Images optimized with appropriate loading strategies
- [ ] Animation performance tested on lower-end devices

### Internationalization Testing
- [ ] Layout remains functional with `dir="rtl"`
- [ ] Text expands gracefully (test with 30% longer content)
- [ ] Numbers format correctly with `Intl.NumberFormat`
- [ ] Icons and chevrons mirror appropriately

### Dark Mode Testing
- [ ] All colors adapt properly to dark mode
- [ ] Images have appropriate dark mode treatments
- [ ] Shadows remain subtle and appropriate
- [ ] Brand assets have dark mode variants
- [ ] Theme toggle button functions correctly in header
- [ ] Theme preference persists across page reloads
- [ ] Semantic color tokens used throughout (no hardcoded colors)
- [ ] shadcn components adapt automatically to theme changes
- [ ] SSR compatibility: `suppressHydrationWarning` on html element
