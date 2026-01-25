# Product Design: Add Due Dates to Todos

**Size: M**

## Overview

This feature adds due date functionality to the existing todos system, enabling users to assign deadlines to their tasks and organize them by urgency. Users will be able to set due dates when creating or editing todos, view them sorted by due dates, and filter by time-based categories (due today, this week, or overdue). The feature enhances the existing sorting and filtering controls to help users prioritize and manage time-sensitive tasks.

## UI/UX Design

### Due Date Display on Todo Items

Each todo item card will display the due date information alongside the existing todo title and completion checkbox:

- **No due date set**: No date indicator shown
- **Due date in future**: Small calendar icon with date shown in subtle text (e.g., "Due Dec 25")
- **Due today**: Calendar icon with "Today" badge in primary color to draw attention
- **Due this week**: Calendar icon with date and subtle "This week" indicator
- **Overdue**: Calendar icon with date shown in warning/red color with "Overdue" badge

The due date will appear between the todo title and the action buttons, ensuring it's visible without cluttering the interface. On mobile, the layout remains clean with the date shown as a small chip beneath the title.

### Adding/Editing Due Dates

#### In Create Todo Form

The existing "Add new todo" card will be enhanced with an optional due date selector:

- Add a small calendar icon button next to the "Add" button
- Clicking the calendar icon opens a date picker dialog
- The date picker shows:
  - Calendar view for selecting any date
  - Quick selection buttons: "Today", "Tomorrow", "This Week", "Next Week"
  - "No due date" option to keep tasks without deadlines
  - "Clear" button to remove a previously selected date
- When a due date is selected, it appears as a small chip/badge in the input area showing the date
- Users can still create todos without due dates (optional feature)
- Pressing Enter with the input focused creates the todo with the selected due date (if any)

#### In Edit Mode

When editing an existing todo:

- The inline edit view includes a small calendar icon button
- Clicking it opens the same date picker dialog
- Current due date (if set) is highlighted in the picker
- Users can change the date or clear it entirely
- Changes are saved when the user clicks "Save"

### Enhanced Filtering Controls

The existing "TodoControls" card will be expanded to include due date filtering options:

**New Filter Section - "Due Date Filter":**

Located below or alongside the existing "Sort by" dropdown, this section includes:

- **Filter chips/buttons** (radio-style, only one active at a time):
  - "All" (default - shows all todos regardless of due date)
  - "Due Today" (shows only todos due today)
  - "Due This Week" (shows todos due within the next 7 days)
  - "Overdue" (shows todos with due dates in the past that aren't completed)
  - "No Due Date" (shows todos without any due date set)

The active filter is highlighted with primary color. The filter applies immediately when clicked, providing instant feedback.

**Filter behavior:**
- Filters work in combination with the existing "Hide Completed" toggle
- When "Overdue" filter is active, it automatically excludes completed todos (since completed tasks can't be overdue)
- Filter counts shown in parentheses (e.g., "Overdue (3)") to help users see at a glance how many items match each filter

### Enhanced Sorting Options

The existing "Sort by" dropdown will include new due date-based sorting options:

- "Due Date (Earliest First)" - sorts todos by due date, showing soonest deadlines first
- "Due Date (Latest First)" - sorts todos by due date in reverse order
- Todos without due dates appear at the end when sorting by due date

The existing sort options remain available (Newest, Oldest, Recently Updated, Title A-Z, Title Z-A).

### Enhanced Statistics Panel

The "TodoStats" component will be enhanced to show due date statistics:

**Additional stats displayed:**
- "Due Today: X" (count of todos due today)
- "Overdue: X" (count of overdue incomplete todos, shown in warning color if > 0)

These stats appear below the existing completion progress bar as small info chips.

### Date Picker Dialog Design

The date picker dialog provides a user-friendly way to select dates:

**Dialog Layout:**
- Modal dialog with clean, focused design
- Title: "Set Due Date"
- Calendar grid showing current month with navigation arrows
- Today's date highlighted with a subtle indicator
- Selected date highlighted in primary color
- Quick action buttons at the top:
  - "Today" (sets due date to current day)
  - "Tomorrow" (sets due date to next day)
  - "Next Week" (sets due date to 7 days from now)
  - "Clear" (removes due date)
- Bottom action buttons:
  - "Cancel" (closes without saving)
  - "Set Date" (confirms selection and closes)

**Keyboard Navigation:**
- Arrow keys navigate between dates
- Enter confirms selection
- Escape cancels

### Empty States and Visual Feedback

**When filtering by "Due Today" with no matches:**
- Message: "📅 No todos due today! You're all caught up."

**When filtering by "Overdue" with no matches:**
- Message: "✅ No overdue todos. Great job staying on top of things!"

**When filtering by "This Week" with no matches:**
- Message: "📆 No todos due this week."

**Success feedback:**
- When setting a due date: Brief toast notification "Due date set to [date]"
- When completing an overdue todo: Celebration effect with message "Better late than never! 🎉"

### Visual Priority Indicators

To help users quickly assess urgency without reading dates:

- **Overdue todos**: Card has subtle red/warning left border (similar to existing completed todos gradient)
- **Due today**: Card has subtle primary color left border
- **Due this week**: No special border (normal appearance)
- **Future/No due date**: No special border (normal appearance)

These visual cues work alongside the existing "completed" gradient styling, helping users scan their list quickly.

### Mobile Considerations

**Responsive adaptations:**
- Date picker on mobile shows a mobile-optimized calendar view
- Filter chips stack vertically or wrap to multiple lines
- Due date badges use compact format (e.g., "Today" instead of full date)
- Calendar icon button is appropriately sized for touch (min 44px touch target)

**Touch interactions:**
- All date-related buttons have adequate touch targets
- Swipe gestures remain available for todo interactions
- Date picker supports touch-friendly date selection

### User Flow Example

**Creating a todo with a due date:**
1. User types todo title in the input field
2. User clicks the small calendar icon next to "Add" button
3. Date picker dialog opens
4. User clicks "Tomorrow" quick button (or selects date from calendar)
5. Dialog closes, showing selected date as a chip in the input area
6. User clicks "Add" or presses Enter
7. New todo appears in the list with due date badge visible
8. Toast notification confirms creation

**Filtering by overdue todos:**
1. User clicks "Overdue" filter chip in the controls section
2. List instantly updates to show only overdue incomplete todos
3. Overdue count updates in the filter button
4. User can complete overdue todos or edit their due dates
5. Clicking "All" removes the filter

## Edge Cases

**Overdue completed todos:**
- Completed todos with past due dates are not considered "overdue"
- They appear normally with strikethrough and completed styling
- The "Overdue" filter excludes them

**Todos created before this feature:**
- All existing todos have no due date by default
- They appear in the "No Due Date" filter
- Users can add due dates to them by editing

**Timezone handling:**
- Due dates use the user's local timezone
- "Today" is calculated based on local time
- A todo due at "end of day" is considered due the entire day

**Sorting with mixed due dates:**
- When sorting by due date, todos without due dates appear last
- Within "no due date" section, existing sort preferences apply

**Filter combinations:**
- "Hide Completed" + "Overdue" works intuitively (overdue filter already excludes completed)
- "Uncompleted First" grouping works with due date filters
- Multiple filters can be applied simultaneously