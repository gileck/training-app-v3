# Product Design: Improve Todo Item Page Design and UX

**Size: M**

## Overview

The single todo item page (`/todos/:todoId`) currently provides a basic view with minimal information and limited interaction options. This redesign will transform it into a rich, engaging experience that matches the polish and creativity of the main todos list page, while adding unique value for viewing individual todo items.

The improved page will feature beautiful gradients, animations, inline editing, richer metadata display, and better mobile responsiveness. Users will be able to view complete todo details, edit inline without modal dialogs, see visual priority indicators for due dates, and enjoy delightful interactions when completing tasks.

## UI/UX Design

### Visual Design & Layout

**Page Background:**
- Apply the same subtle gradient background from the main todos page for visual consistency
- Use `todo-gradient-bg` styling with soft radial gradients in primary/secondary theme colors
- Create cohesive experience between list and detail views

**Header Section:**
- Back button with left arrow icon and "Back to Todos" text (desktop) or just icon (mobile)
- Page title "Todo Details" removed in favor of more space for content
- Breadcrumb navigation: "My Todos > [Todo title truncated]"

**Main Card Layout:**
- Large, prominent card with gradient border effect (`todo-card-gradient`)
- Apply same hover effects as todo items in list view
- Left border color indicator:
  - Red (destructive) for overdue tasks
  - Primary color for tasks due today
  - No special border for other tasks
- Success gradient background (`todo-success-gradient`) when todo is completed

### Todo Information Display

**Title Section:**
- Large, prominent title text (text-2xl on desktop, text-xl on mobile)
- Inline editing: Click title to edit directly (no separate edit mode)
- Strikethrough animation with fade effect when completed
- Character count indicator when editing (subtle, bottom-right)

**Completion Status:**
- Large custom checkbox (same design as list view) positioned prominently
- Animated gradient fill when checked
- Click anywhere on checkbox to toggle
- Celebration confetti effect when marking as complete
- Toast message: "🎉 Great job completing '[title]'!" (or "Better late than never! 🎉" if overdue)
- Success message with undo option (3-second window)

**Due Date Display:**
- Prominent badge with calendar icon
- Color coding:
  - Red badge with "OVERDUE" label for past-due incomplete tasks
  - Primary color badge with "DUE TODAY" for today's tasks
  - Secondary color badge with "Due [date]" for future tasks
- Show relative time: "Due in 3 days", "Due tomorrow", "Due today"
- Click to open calendar picker for editing
- Empty state: Subtle "Set due date" button with calendar icon

**Metadata Section:**
- Created date with clock icon
- Last updated date with refresh icon
- Completion date (only shown if completed) with checkmark icon
- All dates show both relative time ("2 hours ago") and absolute ("Jan 26, 2026 at 3:45 PM")
- Subtle, muted text styling for non-intrusive display

### Interactive Elements

**Completion Toggle:**
- Large, touch-friendly checkbox (48px touch target on mobile)
- Position near title for easy access
- Animated gradient background on hover
- Scale animation on click
- Confetti celebration on completion (respects prefers-reduced-motion)
- Card bounces briefly when completing

**Inline Editing:**
- Click title text to enter edit mode
- Input field with gradient focus border effect
- Auto-focus and select all text when entering edit mode
- Save on Enter key, cancel on Escape key
- "Save" and "Cancel" buttons appear below input
- Loading state while saving (disabled input, spinner)
- Validation: Show error if title is empty

**Due Date Picker:**
- Click due date badge or "Set due date" button to open calendar
- Calendar dialog with today highlighted
- Quick select buttons: "Today", "Tomorrow", "Next Week", "Clear"
- Close dialog on date selection or cancel
- Loading state while updating
- Success toast: "Due date updated"

**Action Buttons:**
- Delete button with trash icon (outline style, destructive text color)
- Confirmation dialog before deletion
- After delete: Navigate back to todos list with success toast
- Edit button removed (editing is now inline)

### Mobile Optimization

**Responsive Layout:**
- Full-width layout with appropriate padding (p-4)
- Stack elements vertically for better mobile flow
- Larger touch targets (min 48px) for all interactive elements
- Bigger fonts for better readability at arm's length
- Bottom action buttons sticky on scroll for easy access

**Touch Interactions:**
- Larger checkbox (48px vs 40px desktop)
- Full-width due date badge on mobile
- Action buttons full-width and stacked
- Swipe left to go back (browser native behavior)

### Animation & Delight

**Entrance Animation:**
- Card fades in with slight upward slide
- Stagger animation for different sections (title, dates, actions)
- Smooth, 300ms duration

**Completion Celebration:**
- Confetti particles burst from checkbox
- Card background transitions to success gradient
- Gentle bounce animation
- Toast notification with celebratory message
- All animations respect `prefers-reduced-motion`

**Hover States:**
- Checkbox: border color change + background tint
- Title (when editable): subtle background highlight
- Buttons: scale slightly + shadow increase
- All transitions: 200-300ms ease curve

**Loading States:**
- When toggling completion: checkbox shows spinner
- When saving edits: input disabled with spinner
- When updating due date: badge shows spinner
- Linear progress bar at top of page for any async action

### Error Handling

**Network Errors:**
- Toast notification with error message
- Retry button in toast
- Keep user on page with previous data visible
- Don't navigate away on failed deletion

**Not Found:**
- Friendly message: "This todo doesn't exist or was deleted"
- Button to go back to todos list
- Illustration or emoji (🔍)

**Permission Errors:**
- Message: "You don't have access to this todo"
- Back button to todos list

### Accessibility

**Keyboard Navigation:**
- Tab through all interactive elements
- Enter to activate buttons/checkboxes
- Escape to cancel editing or close dialogs
- Focus visible indicators on all elements

**Screen Readers:**
- Proper ARIA labels on checkbox: "Mark as complete" / "Mark as incomplete"
- Status announcements when completion changes
- Form labels for all inputs
- Dialog roles for calendar picker

**Visual:**
- High contrast for all text (WCAG AA compliance)
- Color not sole indicator (icons + text for due dates)
- Focus indicators visible and clear

## Edge Cases

**Very Long Titles:**
- Wrap text naturally (no truncation on detail page)
- Multi-line display allowed
- Edit input expands to accommodate

**No Due Date:**
- Show subtle "Set due date" button instead of badge
- Not treated as urgent or overdue

**Rapid Toggling:**
- Debounce completion toggle to prevent rapid API calls
- Show loading state, disable during mutation
- Queue subsequent clicks

**Stale Data:**
- Background refresh when page becomes visible
- Show subtle "Updated" indicator if data changed
- No disruptive full reload

**Deleted While Viewing:**
- If todo deleted elsewhere, detect on next action
- Show friendly message and redirect to list
- Don't throw error to user