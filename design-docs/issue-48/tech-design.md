# Technical Design: Add Due Dates to Todos

**Size: M** | **Complexity: Medium**

## Overview

Add optional due date functionality to todos including date picker UI, filtering by due date categories (today/this week/overdue), sorting by due dates, and visual indicators. Uses shadcn/ui Calendar component with Popover for date selection.

## Files to Create

**UI Components:**
- `src/client/routes/Todos/components/DatePickerDialog.tsx`
  - Date picker dialog using shadcn Calendar and Popover components
  - Quick action buttons (Today, Tomorrow, This Week, Clear)
  - Keyboard navigation support

**Utility Functions:**
- `src/client/routes/Todos/utils/dateUtils.ts`
  - Helper functions for date comparisons (isToday, isDueThisWeek, isOverdue)
  - Date formatting utilities
  - Due date filtering logic

## Files to Modify

**Database Schema:**
- `src/server/database/collections/todos/types.ts`
  - Add `dueDate?: Date` to `TodoItem` interface
  - Add `dueDate?: string` to `TodoItemClient` interface (ISO string format)
  - Update `TodoItemUpdate` to include optional `dueDate` field

**API Types:**
- `src/apis/todos/types.ts`
  - Add `dueDate?: string` to `CreateTodoRequest` (ISO string)
  - Add `dueDate?: string | null` to `UpdateTodoRequest` (null = clear due date)

**API Handlers:**
- `src/apis/todos/handlers/createTodo.ts`
  - Accept and validate optional `dueDate` from request
  - Parse ISO string to Date object before saving to database

- `src/apis/todos/handlers/updateTodo.ts`
  - Accept and validate optional `dueDate` from request
  - Handle null value to clear due date
  - Parse ISO string to Date object before saving

**Client Hooks:**
- `src/client/routes/Todos/hooks.ts`
  - Update `CreateTodoInput` to include `dueDate?: string`
  - Update optimistic create/update logic to include `dueDate` field

**Store:**
- `src/client/routes/Todos/store.ts`
  - Add `dueDateFilter: 'all' | 'today' | 'week' | 'overdue' | 'none'` to state
  - Add `setDueDateFilter` action
  - Include in persisted state

**Sorting & Filtering:**
- `src/client/routes/Todos/utils.ts`
  - Add `'due-earliest'` and `'due-latest'` to `TodoSortBy` type
  - Implement due date sorting in `sortTodos` function
  - Create `filterTodosByDueDate` function for due date filtering

**UI Components:**
- `src/client/routes/Todos/components/CreateTodoForm.tsx`
  - Add calendar icon button next to Add button
  - Show selected due date as chip/badge in input area
  - Pass `dueDate` to mutation

- `src/client/routes/Todos/components/TodoItem.tsx`
  - Display due date badge between title and action buttons
  - Apply visual indicators (border colors) for overdue/due today
  - Add calendar button in edit mode
  - Handle due date updates

- `src/client/routes/Todos/components/TodoControls.tsx`
  - Add due date filter chips (All, Due Today, Due This Week, Overdue, No Due Date)
  - Add "Due Date (Earliest)" and "Due Date (Latest)" to sort dropdown
  - Wire up filter/sort actions to store

- `src/client/routes/Todos/components/TodoStats.tsx`
  - Add "Due Today" count (using `isToday` helper)
  - Add "Overdue" count in warning color (using `isOverdue` helper)
  - Display as info chips below progress bar

- `src/client/routes/Todos/Todos.tsx`
  - Apply due date filter to `displayTodos` computation
  - No other changes needed (filter/sort already applied via useMemo)

## Data Model

**TodoItem (Database):**
```typescript
interface TodoItem {
    _id: ObjectId;
    userId: ObjectId;
    title: string;
    completed: boolean;
    dueDate?: Date;  // NEW - optional due date
    createdAt: Date;
    updatedAt: Date;
}
```

**TodoItemClient (API):**
```typescript
interface TodoItemClient {
    _id: string;
    userId: string;
    title: string;
    completed: boolean;
    dueDate?: string;  // NEW - ISO date string (optional)
    createdAt: string;
    updatedAt: string;
}
```

## State Management

**Due Date Filter State (Zustand):**
```typescript
interface TodoPreferencesState {
    // Existing fields...
    sortBy: TodoSortBy;
    uncompletedFirst: boolean;
    hideCompleted: boolean;
    
    // NEW
    dueDateFilter: 'all' | 'today' | 'week' | 'overdue' | 'none';
    setDueDateFilter: (filter: string) => void;
}
```

**New Sort Options:**
- `'due-earliest'` - Sort by due date ascending (soonest first), no due date at end
- `'due-latest'` - Sort by due date descending (furthest first), no due date at end

## Implementation Notes

**Date Handling:**
- Client stores dates as ISO strings in state/cache
- Server stores dates as Date objects in MongoDB
- Convert ISO → Date when saving (server handlers)
- Convert Date → ISO when returning (server handlers)
- All date comparisons done in local timezone using `new Date()` comparisons

**Due Date Filters:**
- "All" - No filtering (default)
- "Due Today" - `dueDate` is today (same calendar day)
- "Due This Week" - `dueDate` is within next 7 days (inclusive)
- "Overdue" - `dueDate` is in the past AND `completed: false`
- "No Due Date" - `dueDate` is undefined/null

**Visual Indicators:**
- Overdue todos: Red/warning left border + "Overdue" badge
- Due today: Primary color left border + "Today" badge
- Due this week: Calendar icon + date text
- Future/no due date: No special styling

**shadcn/ui Integration:**
- Install Calendar component: `npx shadcn@latest add calendar`
- Install Popover component: `npx shadcn@latest add popover`
- Use Dialog component (already installed) for mobile-friendly date picker
- Use Badge component (already installed) for date display

**Empty States:**
- "Due Today" filter with no results: "📅 No todos due today! You're all caught up."
- "Overdue" filter with no results: "✅ No overdue todos. Great job staying on top of things!"
- "This Week" filter with no results: "📆 No todos due this week."

**Edge Cases:**
- Completed todos with past due dates are NOT considered overdue
- Todos without due dates appear last when sorting by due date
- Clearing a due date sends `dueDate: null` in update request
- Due date defaults to undefined (not required field)
- "Today" is calculated based on user's local timezone