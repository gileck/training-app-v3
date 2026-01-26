# Technical Design: Mobile-Responsive Todo List Redesign

**Size: M** | **Complexity: Medium**

## Overview

Enhance the entire todo list page (`/todos`) with comprehensive mobile-first responsive design improvements. This includes optimizing all components for touch interaction, improving spacing and typography for mobile devices, and ensuring excellent usability on screens from 320px to 640px width while maintaining desktop functionality.

## Files to Modify

**CSS Styles:**
- `src/client/styles/todos.css`
  - Add mobile-specific media queries for all component classes
  - Enhance touch target sizes (minimum 44x44px)
  - Improve spacing and typography for small screens
  - Add mobile-optimized layouts for forms, controls, and cards
  - Update existing `@media (max-width: 640px)` breakpoint with comprehensive mobile improvements

**React Components:**
- `src/client/routes/Todos/components/CreateTodoForm.tsx`
  - Update layout to stack vertically on mobile (input field, calendar button, add button)
  - Increase button heights to 48px on mobile for better touch targets
  - Make due date badge display full-width on mobile
  - Add responsive className variations

- `src/client/routes/Todos/components/TodoItem.tsx`
  - Enhance checkbox touch area to 48x48px on mobile
  - Allow title text to wrap to multiple lines (2-3 lines max) instead of truncating
  - Arrange action buttons with increased spacing on mobile
  - Move due date badge to a separate full-width row on mobile
  - Improve edit mode layout for mobile (stack save/cancel buttons)

- `src/client/routes/Todos/components/TodoControls.tsx`
  - Already has basic mobile layout, enhance with better spacing
  - Make sort dropdown full-width on mobile
  - Stack toggle switches vertically with more padding
  - Ensure filter buttons wrap gracefully with larger touch targets

- `src/client/routes/Todos/components/TodoStats.tsx`
  - Increase font sizes for better readability on mobile
  - Add more vertical padding to the stats card
  - Make progress bar slightly taller (8px instead of 6px)
  - Ensure due date badges stack properly on small screens

- `src/client/routes/Todos/Todos.tsx`
  - Update header layout for mobile (title size, refresh button positioning)
  - Ensure proper spacing between sections on mobile
  - No major structural changes needed (already uses responsive patterns)

**Other Components (minor adjustments):**
- `src/client/routes/Todos/components/DatePickerDialog.tsx`
  - Verify quick action buttons wrap properly on small screens
  - Ensure dialog content is fully visible on mobile

- `src/client/routes/Todos/components/EmptyState.tsx`
  - Adjust icon and text sizes for mobile visibility
  - Already uses responsive patterns, minor refinements only

## Implementation Notes

**Mobile-First Breakpoint Strategy:**
- Primary breakpoint: `max-width: 640px` (mobile devices)
- Focus on screens from 320px (iPhone SE) to 640px
- Desktop layout (641px+) remains largely unchanged with subtle improvements

**Touch Target Requirements:**
- All interactive elements: minimum 44x44px touch area
- Buttons: 48px height on mobile (vs 40px desktop)
- Checkbox: 48x48px touch area (24x24px visual)
- Icon buttons: 44x44px minimum
- Increased spacing between adjacent buttons: 12px gap

**Typography Adjustments:**
- Maintain existing hierarchy but increase sizes slightly on mobile
- Ensure minimum 16px for input fields (prevents iOS zoom)
- Line-height: 1.5 for better readability
- Allow text wrapping instead of truncation where appropriate

**Layout Patterns:**
- Vertical stacking for form elements on mobile
- Full-width elements for better touch accessibility
- Increased vertical padding (16px → 24px for cards)
- Horizontal gaps between elements: 12px → 16px on mobile

**CSS Approach:**
- Enhance existing mobile media query at bottom of `todos.css`
- Add new mobile-specific classes where needed
- Use Tailwind responsive prefixes in components (`sm:`, `md:`)
- Maintain existing animations and effects (respect `prefers-reduced-motion`)

**Accessibility Considerations:**
- All existing ARIA labels and roles remain intact
- Keyboard navigation continues to work on all devices
- Focus states remain visible with adequate contrast
- Touch targets exceed WCAG requirements (44x44px minimum)

**Performance Impact:**
- No additional network requests
- CSS changes only (minimal bundle size impact)
- No new dependencies required
- Responsive styles load conditionally via media queries

**Edge Cases Handled:**
- Very long todo titles: wrap to 3 lines max, then truncate with ellipsis
- Small devices (320px): test all layouts at minimum width
- Large mobile devices (iPhone Pro Max): ensure layout doesn't break
- Orientation changes: layouts adapt smoothly
- Many filter buttons: wrap into multiple rows without horizontal scroll

**Component-Specific Changes:**

1. **CreateTodoForm:**
   - Desktop: horizontal layout (input, calendar, add button in row)
   - Mobile: vertical layout (full-width input, buttons row below)

2. **TodoItem:**
   - Desktop: single-line title with ellipsis, inline buttons
   - Mobile: multi-line title (wrap), larger buttons, due date on separate row

3. **TodoControls:**
   - Desktop: horizontal layout (sort and filters side-by-side)
   - Mobile: vertical stack (sort full-width, toggles stacked, filters wrap)

4. **TodoStats:**
   - Desktop: current compact layout
   - Mobile: increased sizes and spacing for readability

**Testing Requirements:**
- Test on iPhone SE (320px width minimum)
- Test on standard phones (375px - 414px)
- Test on large phones (428px - 430px)
- Test landscape orientation on mobile devices
- Verify touch targets with accessibility inspector
- Test with different font sizes (accessibility settings)
- Verify no horizontal scrolling at any viewport width

**No Database/API Changes:**
- This is a pure UI/UX enhancement
- No schema modifications needed
- No new API endpoints required
- No state management changes (uses existing Zustand store)

**Browser Compatibility:**
- CSS Grid and Flexbox (widely supported)
- CSS custom properties (all modern browsers)
- Media queries (standard support)
- Touch events (native mobile support)