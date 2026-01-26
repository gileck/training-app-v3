# Technical Design: Improve Todo Item Page Design and UX

**Size: M** | **Complexity: Medium**

## Overview

Transform the single todo item page (`/todos/:todoId`) from a basic detail view into a rich, polished experience matching the redesigned todos list page. This involves adding inline editing, celebration animations, due date picker integration, gradient styling, better metadata display, and improved mobile responsiveness - all using existing components and patterns from the main todos list.

## Files to Modify

**Primary Component:**
- `src/client/routes/SingleTodo/SingleTodo.tsx`
  - Complete redesign of layout and interactions
  - Add gradient background (todo-gradient-bg)
  - Implement large custom checkbox with celebration effect
  - Add inline title editing with auto-focus
  - Integrate DatePickerDialog for due date selection
  - Add breadcrumb navigation
  - Implement entrance animations
  - Add celebration confetti on completion
  - Enhance error handling with not-found and permission states
  - Improve mobile layout with larger touch targets
  - Add loading states during mutations

**Supporting Changes:**
- `src/client/routes/SingleTodo/index.ts`
  - No changes needed (already exports component)

## State Management

**Local ephemeral state (useState):**
- `isEditingTitle` - Track inline title edit mode
- `editTitle` - Store temporary title during editing
- `celebrating` - Control celebration effect display
- `datePickerOpen` - Control date picker dialog visibility
- `deleteConfirmOpen` - Control delete confirmation dialog

**React Query (existing hooks):**
- `useTodo(todoId)` - Fetch single todo data with cache
- `useUpdateTodo()` - Mutate todo (title, completed, dueDate)
- `useDeleteTodo()` - Delete todo mutation

**No Zustand stores needed** - all state is ephemeral UI state or managed by React Query.

## Component Structure

**Layout hierarchy:**
```
SingleTodo
├── Gradient background container (todo-gradient-bg)
├── Header section
│   ├── Back button with arrow icon + breadcrumb
│   └── "My Todos > [Todo title]" breadcrumb
├── Main card (todo-card-gradient with entrance animation)
│   ├── Custom checkbox (48px touch target) with celebration
│   ├── Title display/edit section
│   │   ├── Large title text (inline editable)
│   │   ├── Character count during edit
│   │   └── Save/Cancel buttons when editing
│   ├── Due date section
│   │   ├── Badge with color coding (overdue/today/future)
│   │   ├── Relative time display
│   │   └── Click to open DatePickerDialog
│   ├── Metadata section
│   │   ├── Created date (icon + relative + absolute time)
│   │   ├── Updated date (icon + relative + absolute time)
│   │   └── Completion date (conditional, only if completed)
│   └── Action buttons section
│       └── Delete button (with confirmation dialog)
├── DatePickerDialog (reuse from Todos)
├── DeleteTodoDialog (reuse from Todos)
└── CelebrationEffect (reuse from Todos)
```

## Implementation Details

**Gradient Styling:**
- Apply `todo-gradient-bg` to page container
- Use `todo-card-gradient` for main card
- Apply `todo-success-gradient` when todo is completed
- Add border color indicators for overdue/today tasks

**Custom Checkbox:**
- Reuse `.todo-checkbox` CSS class from todos.css
- 48px touch target on mobile (increased from 40px desktop)
- Gradient fill animation on check
- Scale animation on click
- Trigger celebration confetti when completing (not uncompleting)
- Add bounce animation to card on completion

**Inline Title Editing:**
- Click title text to enter edit mode
- Auto-focus input and select all text
- Show character count in bottom-right corner
- Save on Enter, cancel on Escape
- Show Save/Cancel buttons below input
- Loading state during save (disabled input + spinner)
- Validation: prevent empty title

**Due Date Display:**
- Large badge with calendar icon
- Color coding:
  - Red badge with "OVERDUE" for past-due incomplete tasks
  - Primary badge with "DUE TODAY" for today
  - Secondary badge with "Due [date]" for future
- Show relative time: "Due in 3 days", "Due tomorrow"
- Empty state: "Set due date" button with calendar icon
- Click badge/button to open DatePickerDialog

**Metadata Display:**
- Created date: Clock icon + relative ("2 hours ago") + absolute ("Jan 26, 2026 at 3:45 PM")
- Updated date: Refresh icon + relative + absolute
- Completion date: Checkmark icon + relative + absolute (only shown if completed)
- Muted text styling for non-intrusive display

**Celebration Animation:**
- Reuse `CelebrationEffect` component from Todos
- Trigger confetti burst on completion
- Card bounce animation (todo-celebration-bounce)
- Toast notification:
  - If overdue: "Better late than never! 🎉"
  - Otherwise: "🎉 Great job completing '[title]'!"
- Respect prefers-reduced-motion

**Entrance Animation:**
- Card fades in with slide-up (todo-fade-in-up)
- 300ms duration with ease curve
- Stagger metadata sections for polished effect

**Mobile Optimizations:**
- Stack layout vertically on mobile
- Larger checkbox (48px vs 40px)
- Full-width due date badge
- Larger touch targets for all buttons (min 48px)
- Sticky action buttons on scroll (optional)
- Bigger fonts for arm's length readability

**Error Handling:**
- Not found: Friendly message with 🔍 emoji + back button
- Permission error: "You don't have access" message + back button
- Network errors: Toast with retry option
- Mutation errors: Keep user on page, show error, don't navigate
- Failed deletion: Show error, stay on page

**Loading States:**
- Initial load: LinearProgress + "Loading todo..." text
- During mutations: Disable inputs, show spinner in relevant button
- Background revalidation: Subtle indicator (no disruptive reload)

## Accessibility

**Keyboard Navigation:**
- Tab through all interactive elements
- Enter to activate buttons/save edits
- Escape to cancel editing or close dialogs
- Focus visible indicators on all elements

**Screen Readers:**
- ARIA label on checkbox: "Mark as complete" / "Mark as incomplete"
- Status announcements when completion changes
- Proper form labels on all inputs
- Dialog roles for date picker and delete confirmation

**Visual:**
- High contrast text (WCAG AA compliance)
- Color not sole indicator (icons + text for due dates)
- Focus indicators visible and clear
- Respect prefers-reduced-motion for all animations

## Components to Reuse

**From Todos feature:**
- `CelebrationEffect` - Confetti animation component
- `DatePickerDialog` - Date selection dialog with quick actions
- `DeleteTodoDialog` - Confirmation dialog for deletion
- `useUpdateTodo` - Mutation hook for updates
- `useDeleteTodo` - Mutation hook for deletion
- Date utils: `formatDueDate`, `isToday`, `isOverdue`, `getQuickDates`
- `toast` - Notification API
- `prefersReducedMotion` - Animation preference check

**From UI library:**
- Card, Button, Badge, Input, Dialog components
- LinearProgress for loading state
- Icons from lucide-react (Calendar, Clock, RefreshCw, Check, ArrowLeft, etc.)

## CSS Classes to Use

**Existing classes from todos.css:**
- `.todo-gradient-bg` - Page background gradients
- `.todo-card-gradient` - Card with gradient border effect
- `.todo-success-gradient` - Completed todo background
- `.todo-checkbox` - Custom checkbox styling
- `.todo-checkbox.checked` - Checked state with gradient
- `.todo-celebration-bounce` - Bounce animation on complete
- `.todo-fade-in-up` - Entrance animation
- `.todo-completed-text` - Strikethrough for completed titles

**Existing keyframes from globals.css:**
- `@keyframes todo-bounce` - Bounce effect
- `@keyframes todo-fade-in-up` - Slide up entrance
- `@keyframes todo-scale-in` - Checkbox check animation
- `@keyframes todo-confetti` - Confetti particle animation

## Implementation Notes

**Inline Editing Flow:**
1. User clicks title text
2. Replace text with Input component, auto-focus, select all
3. Show character count below (subtle)
4. Show Save/Cancel buttons
5. On Save: validate (not empty), call updateTodo mutation, exit edit mode
6. On Cancel: revert to original title, exit edit mode
7. On Enter key: trigger Save
8. On Escape key: trigger Cancel

**Completion Toggle Flow:**
1. User clicks checkbox
2. Disable checkbox, show spinner
3. Call updateTodo mutation with new completed state
4. On success:
   - If completing (true): trigger celebration, show toast, bounce card
   - If uncompleting (false): just update, no celebration
5. On error: rollback optimistic update, show error toast

**Due Date Update Flow:**
1. User clicks due date badge or "Set due date" button
2. Open DatePickerDialog with current due date pre-selected
3. User selects date or clicks quick action (Today/Tomorrow/Next Week/Clear)
4. On "Set Date": close dialog, call updateTodo mutation
5. Show loading state in badge during update
6. On success: update displayed date
7. On error: show error toast, keep old date

**Delete Flow:**
1. User clicks Delete button
2. Open DeleteTodoDialog confirmation
3. On confirm: call deleteTodo mutation
4. On success: navigate to /todos with success toast
5. On error: show error toast, stay on page

**Stale Data Handling:**
- React Query handles background revalidation automatically
- If todo deleted elsewhere: next mutation will fail with 404
- Show "not found" message and redirect to /todos
- No disruptive full reload during background refresh

**Relative Time Display:**
Format timestamps as:
- "Just now" (< 1 minute)
- "2 minutes ago" (< 1 hour)
- "3 hours ago" (< 24 hours)
- "Yesterday at 3:45 PM" (< 48 hours)
- "Jan 25 at 3:45 PM" (< 1 year)
- "Jan 25, 2025 at 3:45 PM" (> 1 year)

Use a helper function or library like `date-fns` for consistent formatting across created/updated/completed dates.

## Testing Considerations

**Manual Testing:**
- Test inline title editing (save, cancel, validation)
- Test completion toggle (both directions, celebration)
- Test due date selection (all quick actions + calendar)
- Test deletion with confirmation
- Test mobile layout and touch targets
- Test keyboard navigation
- Test error states (network failures, not found)
- Test with prefers-reduced-motion enabled
- Test with screen reader

**Edge Cases:**
- Very long titles (should wrap, not truncate on detail page)
- No due date (show "Set due date" button)
- Rapid clicking (debounce/disable during mutations)
- Deleted while viewing (handle gracefully)
- Overdue tasks (show special messaging)
- Just completed overdue task (show "better late than never" message)