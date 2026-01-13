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
}
```

### Key Design Decisions

1. **No `exerciseDefId` storage**: Workouts reference `planExerciseId` directly, which already contains the exercise definition reference. This ensures workouts stay in sync with plan exercise configuration (sets, reps, weight).

2. **No per-workout overrides**: Exercises use the plan's configured values. Future versions may add per-workout overrides.

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
        { planExerciseId: 'abc123', order: 0 },
        { planExerciseId: 'def456', order: 1 },
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

## UI Locations

1. **ManagePlan > Workouts Tab**: Create, edit, delete, reorder plan workouts
2. **Home > Workouts Tab**: View and start workouts for the active plan
3. **ActiveWorkout**: Save ad-hoc sessions as new plan-workouts

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
