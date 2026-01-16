# Plan Workouts

Plan workouts are reusable, named groups of exercises that belong to a specific training plan.

## Overview

- **Plan-scoped**: Each workout belongs to a specific training plan (not global)
- **Exercise references**: Workouts store `planExerciseId` references (not exercise definitions)
- **Optimistic UI**: All mutations use the optimistic-only pattern for instant feedback

## Data Model

### PlanWorkout

```typescript
interface PlanWorkout {
    _id: ObjectId;
    userId: ObjectId;
    planId: ObjectId;           // Parent training plan
    name: string;               // Workout name (e.g., "Push Day")
    items: PlanWorkoutItem[];   // Ordered list of exercises
    order: number;              // Display order within the plan
    createdAt: Date;
    updatedAt: Date;
}

interface PlanWorkoutItem {
    planExerciseId: ObjectId;   // Reference to plan exercise
    order: number;              // Order within the workout
    sets?: number;              // Per-workout set allocation (optional)
}
```

### Key Design Decisions

1. **No `exerciseDefId` storage**: Workouts reference `planExerciseId` directly, which already contains the exercise definition reference. This ensures workouts stay in sync with plan exercise configuration (reps, weight).

2. **Per-workout set allocation**: Each workout item can optionally specify `sets` to override the exercise's weekly sets. This allows splitting an exercise across multiple workouts (see [Multi-Workout Set Allocation](#multi-workout-set-allocation)).

3. **Cascade deletion**: When a plan is deleted, all its workouts should also be deleted.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `plan-workouts/list` | GET | List all workouts for a plan |
| `plan-workouts/create` | POST | Create a new workout |
| `plan-workouts/update` | POST | Update workout name/exercises |
| `plan-workouts/delete` | POST | Delete a workout |
| `plan-workouts/reorder` | POST | Reorder workouts within a plan |

### Validation

All endpoints validate:
- User is authenticated
- Plan exists and belongs to user
- Workout exists and belongs to plan (for update/delete)
- All `planExerciseId`s belong to the target plan

### Temporary ID Handling

Optimistic updates create workouts with temporary IDs (`temp-{timestamp}`). The API handlers gracefully handle these:

- **Delete**: Returns success for temp IDs (workout was never persisted)
- **Update**: Returns error for temp IDs (can't update non-persisted workout)
- **Reorder**: Filters out temp IDs and only reorders persisted workouts

## Client Usage

### Query Hook

```typescript
import { usePlanWorkouts } from '@/client/features/plan-workouts';

// Fetch workouts for a plan
const { data, isLoading } = usePlanWorkouts(planId);
const workouts = data?.workouts || [];
```

### Mutation Hooks

```typescript
import {
    useCreatePlanWorkout,
    useUpdatePlanWorkout,
    useDeletePlanWorkout,
    useReorderPlanWorkouts,
} from '@/client/features/plan-workouts';

// All mutations are scoped to a planId
const createMutation = useCreatePlanWorkout(planId);
const updateMutation = useUpdatePlanWorkout(planId);
const deleteMutation = useDeletePlanWorkout(planId);
const reorderMutation = useReorderPlanWorkouts(planId);

// Create workout
createMutation.mutate({
    planId,
    name: 'Push Day',
    items: [
        { planExerciseId: 'abc123', order: 0, sets: 5 },  // Custom set allocation
        { planExerciseId: 'def456', order: 1 },          // Uses exercise's weekly sets
    ],
});
```

## Workout Session Integration

When starting an active workout session:

### Ad-hoc (Unsaved) Workout
- `planWorkoutId = null`
- `planWorkoutName = null`
- Save button is **visible**
- User can save the session as a new plan-workout

### From Saved Plan-Workout
- `planWorkoutId = workout._id`
- `planWorkoutName = workout.name`
- Save button is **hidden**
- Session edits (reorder/add/remove) only affect the session, not the template

### Always Syncs to Weekly Progress
Set +/- operations always sync to the backend weekly progress. The `sessionSource` concept was removed since an active plan is always required.

## Multi-Workout Set Allocation

Exercises can be split across multiple workouts with custom set counts per workout.

### Use Case

An exercise with 10 weekly sets can be split into:
- **Workout A (Push)**: 5 sets
- **Workout B (Full Body)**: 5 sets

The Exercise Tab shows total progress (e.g., 7/10), while each workout shows its own progress (e.g., 5/5 and 2/5).

### Data Structure

Progress is tracked at two levels:

```typescript
// In PlanData (plan-data store)
interface PlanData {
    // Total weekly progress per exercise
    weekProgress: Record<number, Record<string, ExerciseProgress>>;
    // Workout-specific sets: {weekNumber: {workoutId: {exerciseId: setsCompleted}}}
    workoutSets: Record<number, Record<string, Record<string, number>>>;
}
```

### Auto-Fill Logic

When adding/removing sets from the **Exercise Tab** or **ad-hoc workouts**, sets are automatically assigned to workouts without prompting the user:

| Action | Strategy | Example |
|--------|----------|---------|
| **Add set** | Fill first workout with capacity | If Workout A is 5/5 and B is 2/5, new set goes to B |
| **Remove set** | Remove from last workout with sets | If A has 5/5 and B has 2/5, removal comes from B |
| **Complete all** | Same as Add set (repeated) | Fills A to 5/5, then B to 5/5 |

This FIFO/LIFO approach ensures predictable behavior without user intervention.

### When Starting a Saved Workout

Sets are tracked against that specific workout. The workout card shows workout-specific progress (e.g., "3/5 sets") not total progress.

### Implementation Details

See inline comments in:
- `src/client/routes/Home/Home.tsx` - Auto-fill functions (`getFirstWorkoutWithCapacity`, `getLastWorkoutWithSets`)
- `src/client/features/plan-data/store.ts` - Store actions (`incrementSetForWorkout`, `decrementSetForWorkout`)

## UI Locations

1. **ManagePlan > Workouts Tab**: Create, edit, delete, reorder plan workouts
2. **Home > Workouts Tab**: View and start workouts for the active plan
3. **ActiveWorkout**: Save ad-hoc sessions as new plan-workouts

## Workout Dialog UI

The workout creation/editing dialog (`WorkoutDialog.tsx`) uses a tabbed interface for better organization:

### Tabs

**Exercises Tab**
- Select exercises from the plan
- Shows "Selected" and "Available" sections
- Displays allocation status (X/Y allocated)
- "All"/"None" quick selection buttons
- No auto-focus on workout name (click pencil icon to edit)

**Sets Tab**
- Configure sets for selected exercises only
- +/- buttons for set count adjustment
- Shows "Already allocated" info only when exercise is used in other workouts
- Over-allocation warnings with clear messaging
- Empty state guides user to select exercises first

### Allocation Bug Fix

Fixed default set allocation when selecting fully-allocated exercises:
- **Before**: Selected exercise defaulted to full weekly sets (e.g., 3) even when already allocated (3/3), causing false warnings
- **After**: Defaults to remaining capacity (0 if fully allocated in other workouts)

### Components

```
WorkoutDialog/
├── WorkoutNameEditor.tsx    # Editable name with pencil icon (no auto-focus)
├── ExercisesTab.tsx        # Exercise selection with sections
└── SetsTab.tsx             # Sets configuration with +/- controls
```

### Dark Mode Support

Warning messages use custom oklch colors that adapt to theme:
- Light mode: `oklch(0.47 0.14 51.32)` - darker orange for contrast
- Dark mode: `oklch(0.70 0.14 51.32)` - lighter orange for visibility

## File Structure

```
src/
├── server/database/collections/planWorkouts/
│   ├── types.ts          # DB types
│   ├── planWorkouts.ts   # CRUD operations
│   └── index.ts
├── apis/plan-workouts/
│   ├── index.ts          # API name constants
│   ├── types.ts          # Request/response types
│   ├── client.ts         # Client API calls
│   ├── server.ts         # Handler exports
│   └── handlers/         # Individual handlers
└── client/features/plan-workouts/
    ├── hooks.ts          # React Query hooks
    └── index.ts          # Public exports
```
