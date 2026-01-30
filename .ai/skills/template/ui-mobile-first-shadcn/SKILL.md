---
name: ui-mobile-first-shadcn
description: globs: .tsx,.css
---
# Mobile-first UI rules (shadcn + Tailwind)

> **Role**: AUTHORITATIVE implementation rules for this project's tech stack.
>
> **When to use**: Always reference when writing actual UI code (.tsx, .css files).
>
> **Related skills**:
> - `ui-design-guidelines` - Design philosophy/inspiration (iOS patterns, advanced concepts like RTL, haptics). Use for understanding WHY, but adapt examples to shadcn/Tailwind.
> - `web-design-guidelines` - On-demand audit tool that fetches external Vercel guidelines. Use for code reviews.
>
> **Priority**: If rules conflict, THIS skill takes precedence for implementation.

## ⚠️ CRITICAL: Mobile-First is a Core Requirement

**This is a mobile-first application.** ALL features and UI MUST be designed and implemented for mobile screens FIRST, especially small screens (~400px CSS viewport width).

**Non-negotiable requirements:**
- **Start with mobile** - Write base styles for ~400px width, then add `sm:`, `md:`, `lg:` for larger screens
- **Test at 400px first** - Every component must look good and be fully usable at mobile width
- **Touch targets ≥ 44px** - All interactive elements must be easily tappable (see Touch Targets section below)
- **No horizontal scroll** - Content must fit within mobile viewport width
- **Thumb-friendly** - Place primary actions in easy-reach zones (bottom of screen)

**Common mobile widths (CSS pixels):**
- iPhone SE: 375px
- iPhone 14: 390px
- Most Android: 360-412px
- Tailwind `sm:` breakpoint: 640px

**The pattern:**
```tsx
// ✅ CORRECT: Mobile-first
<div className="px-2 py-3 sm:px-4 sm:py-6">
  <h1 className="text-lg sm:text-2xl">Title</h1>
</div>

// ❌ WRONG: Desktop-first
<div className="px-4 py-6 max-sm:px-2 max-sm:py-3">
  <h1 className="text-2xl max-sm:text-lg">Title</h1>
</div>
```

---

## Touch Targets (44px Minimum)

**WCAG 2.1 AA requires 44×44px minimum touch targets.** This is non-negotiable for mobile UX.

### Quick Reference

| Element | Minimum Size | Tailwind Classes |
|---------|--------------|------------------|
| Buttons | 44×44px | `min-h-11 min-w-11` or `h-11 px-4` |
| Icon buttons | 44×44px | `h-11 w-11` |
| Checkboxes | 44×44px touch area | Use `::before` extension (see below) |
| List items | 44px height | `min-h-11 py-3` |

### Pattern: Invisible Touch Target Extension

When you need a **small visual element** (e.g., 24px checkbox) with a **large touch area** (44px):

```css
/* Visual element: 24px, Touch area: 44px */
.touch-checkbox {
    position: relative;
    width: 1.5rem;   /* 24px visual */
    height: 1.5rem;  /* 24px visual */
}

.touch-checkbox::before {
    content: '';
    position: absolute;
    /* Extend 10px in each direction: 24px + 20px = 44px */
    inset: -0.625rem;  /* -10px */
}
```

```tsx
// ✅ CORRECT: 44px touch target with 24px visual
<button className="relative h-6 w-6 before:absolute before:inset-[-0.625rem] before:content-['']">
  <CheckIcon className="h-6 w-6" />
</button>

// ❌ WRONG: Only 24px touch target
<button className="h-6 w-6">
  <CheckIcon className="h-6 w-6" />
</button>
```

### Common Sizes

```tsx
// Icon-only button (44px)
<Button variant="ghost" size="icon" className="h-11 w-11">
  <RefreshIcon className="h-5 w-5" />
</Button>

// Standard button (44px height)
<Button className="h-11 px-4">Save</Button>

// Mobile action button (48px for comfortable tapping)
<Button className="h-12 w-12">
  <PlusIcon />
</Button>
```

### Spacing Between Touch Targets

Ensure adequate spacing between adjacent touch targets to prevent mis-taps:
- Minimum gap: `gap-2` (8px)
- Recommended gap: `gap-3` (12px)

---

These rules standardize design across the app using shadcn UI primitives and Tailwind v4 semantic tokens. Dark mode uses the HTML `.dark` class via `next-themes`. Color tokens live in [globals.css](mdc:src/client/styles/globals.css).

## Colors and theming
- Always use semantic tokens instead of hard-coded colors:
  - `bg-background`, `text-foreground`, `border-border`, `ring-ring`
  - `bg-card`/`text-card-foreground`, `bg-popover`/`text-popover-foreground`
  - `bg-primary text-primary-foreground`, `bg-secondary text-secondary-foreground`, `bg-accent text-accent-foreground`
  - `text-muted-foreground`, `bg-muted`
- Do not use hex values in components. If a new color is needed, add/adjust HSL tokens in [globals.css](mdc:src/client/styles/globals.css).
- Use shadcn variants for state colors: `destructive`, `success`, `warning` (see `Alert`, `Badge`, `Button`).
- Respect dark mode automatically by relying on tokens; never conditionalize class strings on theme.

## Layout
- Default page scaffold:
```tsx
export default function Page() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-screen-lg items-center px-3 sm:px-4" />
      </header>
      <main className="mx-auto w-full max-w-screen-lg flex-1 px-2 py-3 pb-20 sm:px-4 sm:pb-4">
        {/* content */}
      </main>
      <footer className="hidden border-t bg-muted/30 sm:block">
        <div className="mx-auto max-w-screen-lg px-4 py-3" />
      </footer>
    </div>
  );
}
```
- Mobile-first: build for small screens, enhance with `sm:`/`md:` modifiers.
- Ensure content clears fixed bottom navigation:
  - Use `pb-20` on mobile main; reduce to `sm:pb-4` on larger screens.
- iOS safe areas when in standalone/PWA:
  - When applicable, add `pt-[env(safe-area-inset-top)]` and `pb-[env(safe-area-inset-bottom)]` to root containers.

## Navigation (Top bar, Drawer, Bottom bar)
- Top bar
  - Height `h-14`, container `max-w-screen-lg`, `backdrop-blur` with `bg-background/80`.
  - Action buttons: `variant="ghost" size="icon"`.
- Drawer (Sheet) item spacing
  - Use a dense rhythm for mobile lists:
    - Container: `grid gap-0.5 px-2 pb-2`
    - Item button: `flex h-9 w-full items-center gap-2.5 rounded-md px-3 text-sm`
    - Icon wrapper: `h-4 w-4`
    - States: selected → `bg-accent text-foreground`; idle → `text-muted-foreground hover:bg-accent hover:text-foreground`
- Bottom nav
  - Fixed bar: `fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 sm:hidden`
  - Buttons: `variant={active ? 'secondary' : 'ghost'} className="flex-1"`

## Components (shadcn usage)
- Prefer shadcn primitives and variants:
  - `Button`, `Input`, `Label`, `Select`, `Switch`, `Card`, `Badge`, `Alert`, `Avatar`, `DropdownMenu`, `Dialog`, `Sheet`, `Separator`
  - Keep props minimal; avoid inline styles.
- Focus states: include `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` on interactive elements (built into `Button`, `Input`, etc.).
- Replace elevation with borders + subtle shadows: `border shadow-sm` for cards/popovers.

### Loading indicators
- Always use a linear progress bar for loading states (no circular spinners):
  - Shared component: `LinearProgress` in `src/client/components/ui/linear-progress.tsx`
  - Indeterminate: `<LinearProgress />`
  - Determinate: `<LinearProgress value={percent} />` (0–100)
  - Place directly below the triggering button or at the top of the container; for full-page loads, add within the content area with `py-2`.

## Radix UI conventions
- shadcn components are Radix-wrapped. When a component is missing, build it on Radix primitives and place it in `src/client/components/ui/*` with shadcn-style API.
- Always use controlled open state when the parent needs to drive UI: `open` + `onOpenChange`. Otherwise, let Radix manage it.
- Portals/overlays
  - Use provided `*Portal`, `*Overlay`, `*Content`. Ensure `z-50` for overlays and avoid custom z-indexes.
  - Scroll locking and focus trapping are handled by Radix—do not add custom body scroll code.
- Accessibility
  - Provide `aria-label` or visible labels; connect `Label` and inputs via `htmlFor`/`id`.
  - Respect keyboard navigation; do not remove outline. Use `focus-visible` utilities.
- Styling hooks
  - Prefer data attributes: e.g., `[data-state=open]`, `[data-disabled]` for styling interactive states.
- SSR/hydration
  - Components using portals may render after mount; avoid measuring sizes during SSR without guards.

## Spacing and typography
- Spacing scale
  - Page padding: `px-2 sm:px-4`, vertical rhythm: `py-3` sections.
  - Lists: `gap-2` by default, dense lists `gap-1` or `gap-0.5`.
- Type scale
  - Page titles: `text-2xl font-semibold`
  - Section titles: `text-lg font-medium`
  - Body: default text; use `text-muted-foreground` for secondary copy.

## Icons
- Use `lucide-react`; size 16–20px on dense UI:
  - Icon-only buttons: `size="icon"` with `h-4 w-4` icons.

## Performance and accessibility
- Avoid conditional render for light/dark classes; rely on tokens for contrast.
- Ensure touch targets ≥ 44px (see Touch Targets section above). Use `min-h-11` or invisible extension pattern.
- Respect reduced motion for potential animations; keep durations at 150–200ms where used.

## Do/Don't
- Do: `bg-primary text-primary-foreground` for primary actions; `variant="outline"` for secondary.
- Do: Use `text-muted-foreground` for less important text.
- Don't: Use raw hex or Tailwind raw color names in components.
- Don't: Add arbitrary margins to fight layout—fix parent spacing instead.
