# Technical Design: Mobile-First Todos Page Redesign

**Size: M** | **Complexity: Medium**

## Overview

Comprehensive mobile-first redesign of the Todos page to improve layout, spacing, and visual hierarchy on mobile devices (~400px). The implementation will refactor existing CSS, add collapsible filter controls, optimize touch targets, and enhance the mobile user experience while maintaining the current feature set and data structures.

## Files to Modify

**Components:**
- `src/client/routes/Todos/Todos.tsx`
  - Update header layout for mobile (icon-only refresh button in top-right)
  - Adjust section spacing (16px between major sections)

- `src/client/routes/Todos/components/TodoStats.tsx`
  - Enhance mobile layout with better spacing
  - Increase badge sizes for mobile visibility
  - Ensure progress bar is prominent (8px height)

- `src/client/routes/Todos/components/CreateTodoForm.tsx`
  - Refine mobile button layout (calendar icon + full-width Add button)
  - Improve selected date badge display

- `src/client/routes/Todos/components/TodoControls.tsx`
  - **Major refactor**: Add collapsible behavior for mobile
  - Show filter count badge when collapsed
  - Horizontal scrollable pill buttons for due date filters
  - Stack sort dropdown and toggle switches vertically on mobile

- `src/client/routes/Todos/components/TodoItem.tsx`
  - Refine mobile layout with proper spacing (12px vertical padding)
  - Ensure action buttons have consistent sizing and spacing
  - Allow title to wrap to max 2 lines on mobile
  - Improve due date badge positioning

**Styles:**
- `src/client/styles/todos.css`
  - Update mobile breakpoint styles (@media max-width: 640px)
  - Refine spacing values (16px horizontal padding, 12px gaps)
  - Add collapsible filter styles
  - Improve touch target sizes (min 48px)
  - Add horizontal scroll styles for pill buttons
  - Refine card padding and margins

**Store (minimal changes):**
- `src/client/routes/Todos/store.ts`
  - Add `filtersExpanded` boolean state (defaults to false on mobile)
  - Add `setFiltersExpanded` action

## State Management

**New State (Zustand Store):**
- Add to `TodoPreferencesState`:
  - `filtersExpanded: boolean` - Tracks whether filter controls are expanded on mobile
  - `setFiltersExpanded: (value: boolean) => void` - Action to toggle filter expansion

**Persistence:**
- `filtersExpanded` should NOT be persisted (ephemeral UI state)
- Existing filter/sort preferences remain persisted

**Store Pattern:**
```typescript
interface TodoPreferencesState {
  // ... existing fields
  filtersExpanded: boolean; // NOT persisted
  setFiltersExpanded: (value: boolean) => void;
}
```

## Implementation Notes

### Collapsible Filter Controls (Mobile Only)

The TodoControls component will use an inline collapsible pattern (NOT a Sheet):

**Collapsed State:**
- Show "Filters" button with chevron icon
- Display active filter count badge (e.g., "Filters (3)")
- Button is full-width, 48px height

**Expanded State:**
- Show all filter controls (sort dropdown, toggles, due date pills)
- Chevron icon rotates to indicate expanded state
- Content slides down with smooth animation

**Implementation Approach:**
```tsx
// In TodoControls.tsx
const filtersExpanded = useTodoPreferencesStore((state) => state.filtersExpanded);
const setFiltersExpanded = useTodoPreferencesStore((state) => state.setFiltersExpanded);

// Mobile: Collapsible section
<div className="sm:hidden">
  <Button 
    onClick={() => setFiltersExpanded(!filtersExpanded)}
    className="w-full h-12"
  >
    Filters {activeFilterCount > 0 && <Badge>{activeFilterCount}</Badge>}
    <ChevronDown className={filtersExpanded ? 'rotate-180' : ''} />
  </Button>
  
  {filtersExpanded && (
    <div className="mt-3 space-y-3">
      {/* Sort dropdown, toggles, due date pills */}
    </div>
  )}
</div>

// Desktop: Always visible (no changes)
<div className="hidden sm:block">
  {/* Existing desktop layout */}
</div>
```

### Mobile Layout Specifications

**Page Container:**
- Padding: 16px horizontal
- Section spacing: 16px between major sections (stats, form, controls, list)

**Header:**
- Title: Left-aligned, with spinner next to it when fetching
- Refresh button: Icon-only (no text), positioned in top-right corner
- Touch target: 48px × 48px minimum

**Statistics Panel:**
- Padding: 16px
- Stats layout: 3 columns (Completed, Progress %, Total)
- Progress bar: 8px height (increased from 6px for visibility)
- Badges: Text size 14px, padding 4px 12px

**Create Form:**
- Input: Full-width, 48px height, 16px font size
- Button row: Calendar icon (48px square) + Add button (flex-1)
- Gap between elements: 12px

**Filter Controls (Expanded):**
- Sort dropdown: Full-width, 48px height
- Toggle switches: Stacked vertically, 12px gap
- Due date pills: Horizontal scrollable row, 48px height
- Pill gap: 8px

**Todo Items:**
- Card padding: 12px vertical, 16px horizontal
- Row 1: Checkbox (48px touch target) + Title (wraps to max 2 lines)
- Row 2: Due date badge (left-aligned)
- Row 3: Action buttons (View, Edit, Delete) - equal spacing, 44px minimum height
- Gap between rows: 12px

**List Spacing:**
- Gap between todo cards: 12px

### Touch Target Guidelines

All interactive elements must meet 48px minimum touch target:
- Buttons: min-height 48px or h-12 class
- Icon buttons: 48px × 48px square
- Checkboxes: 48px touch area (visual size 24px, padding 12px)
- Toggle switches: Default shadcn size is already 48px height

### Responsive Breakpoints

Use existing Tailwind breakpoints:
- Mobile: `< 640px` (default, no prefix)
- Desktop: `sm:` prefix (`>= 640px`)

Pattern:
```tsx
<div className="sm:hidden">Mobile only</div>
<div className="hidden sm:block">Desktop only</div>
```

### Typography Adjustments

**Mobile:**
- Page title: 32px (text-3xl)
- Card title: 16px (text-base)
- Stats numbers: 24px (text-2xl)
- Stats labels: 14px (text-sm)
- Input text: 16px (prevents iOS zoom)

**Desktop:**
- Page title: 36px (text-4xl)
- Card title: 16px (text-base)
- Stats numbers: 20px (text-xl)
- Stats labels: 12px (text-xs)

## Implementation Plan

1. **Update store** (`src/client/routes/Todos/store.ts`)
   - Add `filtersExpanded: boolean` field (default false)
   - Add `setFiltersExpanded` action
   - Ensure it's NOT included in partialize (ephemeral state)

2. **Refactor TodoControls component** (`src/client/routes/Todos/components/TodoControls.tsx`)
   - Add mobile collapsible section with Button + chevron
   - Calculate active filter count for badge
   - Wrap existing controls in collapsible content area
   - Keep desktop layout unchanged (always visible)
   - Import and use `filtersExpanded` state from store

3. **Update mobile CSS** (`src/client/styles/todos.css`)
   - Refine page container padding (16px)
   - Update section spacing (16px gaps)
   - Increase progress bar height (8px on mobile)
   - Adjust card padding (12px vertical, 16px horizontal)
   - Update touch targets (48px minimum)
   - Add horizontal scroll styles for due date pills
   - Refine list item gaps (12px)
   - Update badge sizes for mobile

4. **Refine Todos page header** (`src/client/routes/Todos/Todos.tsx`)
   - Mobile: Icon-only refresh button in top-right, spinner next to title
   - Adjust section spacing classes (mb-4 → mb-5 for consistency)

5. **Enhance TodoStats mobile layout** (`src/client/routes/Todos/components/TodoStats.tsx`)
   - Verify stats grid spacing (gap-4 on mobile)
   - Ensure progress bar height (h-2 on mobile = 8px)
   - Check badge sizing (text-sm px-3 py-1 on mobile)

6. **Refine CreateTodoForm mobile layout** (`src/client/routes/Todos/components/CreateTodoForm.tsx`)
   - Verify button row layout (calendar 48px square, add button flex-1)
   - Check gap spacing (gap-3 = 12px)

7. **Enhance TodoItem mobile layout** (`src/client/routes/Todos/components/TodoItem.tsx`)
   - Verify card padding (16px horizontal for alignment)
   - Check action button sizing (min-h-11 = 44px)
   - Ensure title wrapping (max 2 lines with -webkit-line-clamp)

8. **Test responsive behavior**
   - Test at 375px, 390px, 400px viewports
   - Verify touch targets are all 44px+
   - Check collapsible filter behavior
   - Verify horizontal scroll for due date pills
   - Test with long todo titles
   - Verify spacing consistency across all sections

9. **Cross-browser testing**
   - iOS Safari (PWA mode)
   - Chrome Android
   - Verify input focus doesn't trigger zoom (16px font size)

10. **Run checks**
    - `yarn checks` to verify no linting/type errors
    - Manual QA on mobile device or simulator