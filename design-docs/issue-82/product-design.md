# Product Design: Mobile-First Todos Page Redesign

**Size: M**

## Overview

The Todos page needs a comprehensive mobile-first redesign to deliver a polished, professional experience on small screens (~400px). The current implementation has layout issues including inconsistent spacing, cramped controls, and poor visual hierarchy on mobile. This redesign will transform the page into a clean, well-organized mobile experience that feels native and intuitive.

## UI/UX Design

### Mobile Layout (~400px viewport)

#### Page Header
- Title "My Todos" with gradient text, left-aligned
- Refresh button as icon-only in the top-right corner (not full-width)
- Background refresh indicator shown as subtle spinner next to title
- Clean, minimal header with proper breathing room (16px horizontal padding)

#### Statistics Panel
- Compact horizontal layout with 3 stats in a row
- Stats displayed as: Completed count, Progress percentage, Total count
- Progress bar below stats (8px height for visibility)
- Due Today and Overdue badges displayed below progress bar when applicable
- Card has subtle background with proper padding (16px)

#### Create Todo Form
- Single input field spanning full width
- Two-button row below input:
  - Calendar icon button (48px square) on the left
  - "Add Todo" button filling remaining width
- Selected due date shown as dismissible badge below buttons
- All touch targets minimum 48px height

#### Filter Controls
- Collapsible/expandable section to reduce visual clutter
- When expanded:
  - Sort dropdown (full width, 48px height)
  - Toggle switches stacked vertically with clear labels:
    - "Show uncompleted first"
    - "Hide completed"
  - Due date filter as horizontally scrollable pill buttons:
    - All | Today | This Week | Overdue | No Date
- Collapsed state shows active filter count badge

#### Todo List Items
- Each todo card with consistent padding (16px horizontal, 12px vertical)
- Layout structure:
  - Row 1: Checkbox (48px touch target) + Todo title (wraps to max 2 lines)
  - Row 2: Due date badge (if applicable), left-aligned
  - Row 3: Action buttons in horizontal row with equal spacing:
    - View button (with icon + "View" text)
    - Edit button (with icon + "Edit" text)
    - Delete button (with icon only, destructive color)
- Completed todos:
  - Subtle green-tinted background
  - Title with strikethrough animation
  - Reduced opacity (60%)
- Overdue todos:
  - Left border accent in destructive color (4px)
  - Overdue badge in destructive variant
- Due today todos:
  - Left border accent in primary color (4px)
  - "Today" badge in primary variant

#### Edit Mode (within todo item)
- Input field replaces title (full width)
- Action row with:
  - "Set Due Date" button (full width)
  - Save and Cancel buttons side by side below
- All buttons 48px height

#### Empty States
- Centered content with emoji icon
- Clear message explaining the empty state
- Different messages for:
  - No todos at all
  - All todos completed (when hiding completed)
  - No todos matching filter

#### Completed Section Divider
- Horizontal line with "Completed - X" text centered
- Adequate spacing above and below (24px)

### Spacing & Visual Hierarchy

- Page padding: 16px horizontal
- Section spacing: 16px between major sections (stats, form, controls, list)
- List item spacing: 12px between todo cards
- Touch targets: Minimum 48px for all interactive elements
- Input fields: 48px height with 16px font size (prevents iOS zoom)

### Interaction Patterns

- Checkbox tap: Immediate visual feedback with scale animation, celebration effect on completion
- Swipe gestures: Not implemented (explicit buttons preferred for clarity)
- Pull to refresh: Supported via refresh button
- Loading states: Linear progress bar at top of content area
- Error states: Alert banner below header with shake animation

### Tablet/Desktop Enhancements (640px+)

- Header: Title and refresh button on same row
- Create form: Input, calendar button, and add button on single row
- Filter controls: Always visible, horizontal layout
- Todo items: Single-row layout with checkbox, title, badges, and action buttons inline
- Action buttons: Icon-only (no text labels)
- Wider max-width container (768px) with centered content

## Edge Cases

- **Long todo titles**: Truncate with ellipsis on desktop, wrap to max 2 lines on mobile
- **Many active filters**: Show filter count badge when collapsed; scrollable pills when expanded
- **Offline mode**: Show offline banner at top; optimistic updates continue to work
- **Rapid checkbox toggling**: Debounce to prevent double-triggers; show loading state on affected item