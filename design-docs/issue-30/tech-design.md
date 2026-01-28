# Technical Design: Exercise Definition Overrides in Training Plans

**Size: L** | **Complexity: High**

## Overview

Enable users to override exercise definition fields (name, image, muscles, type, bodyweight/static flags) on a per-plan-exercise basis. Overrides are stored in the `planExercises` collection as optional fields that take precedence over the original `exerciseDefinition`. When displaying plan exercises, UI components merge the override fields with the base definition. Users can customize exercises through an expandable section during add or via a "Customize" button when editing, with the ability to reset individual fields or all overrides to defaults.

## Implementation Phases

This feature will be split into 3 PRs:

### Phase 1: Database Schema & API Foundation (M)
Add override fields to `PlanExercise` schema and update API handlers to accept/return overrides. This phase enables storing overrides without UI changes.

**Files to modify:**
- `src/server/database/collections/planExercises/types.ts` - Add override fields
- `src/apis/plan-exercises/types.ts` - Update request/response types
- `src/apis/plan-exercises/handlers/addPlanExercise.ts` - Accept override fields
- `src/apis/plan-exercises/handlers/updatePlanExercise.ts` - Update override fields
- `src/apis/plan-exercises/handlers/listPlanExercises.ts` - Return merged exercise data

### Phase 2: Display Overrides & Indicators (M)
Update UI components to display overridden values and show visual indicators for customized exercises.

**Files to modify:**
- `src/client/routes/ManagePlan/components/exercises/PlanExerciseCard.tsx` - Show customized badge and overridden values
- `src/client/routes/ManagePlan/components/exercises/EditExerciseDialog.tsx` - Display merged exercise info
- Helper utilities for merging override fields with base definition

### Phase 3: Customize Exercise Interface (M)
Implement the full customization UI with expandable section in add flow, customize dialog in edit flow, and reset functionality.

**Files to create:**
- `src/client/routes/ManagePlan/components/exercises/CustomizeExerciseDialog.tsx` - Main customization interface
- `src/client/routes/ManagePlan/components/exercises/CustomizeExerciseSection.tsx` - Expandable section for add flow

**Files to modify:**
- `src/client/routes/ManagePlan/components/exercises/AddExerciseDialog.tsx` - Add expandable customize section
- `src/client/routes/ManagePlan/components/exercises/ExerciseConfigForm.tsx` - Integrate customize section
- `src/client/routes/ManagePlan/components/exercises/EditExerciseDialog.tsx` - Add customize button

## Data Model

**PlanExercise Schema Changes:**

Add optional override fields to `PlanExercise` interface in `src/server/database/collections/planExercises/types.ts`:

```typescript
export interface PlanExercise {
    // ... existing fields ...
    
    // Exercise definition overrides (optional - null means use original)
    overrideName?: string | null;
    overrideImageUrl?: string | null;
    overridePrimaryMuscle?: string | null;
    overrideSecondaryMuscles?: string[] | null;
    overrideType?: string | null;
    overrideIsBodyweight?: boolean | null;
    overrideIsStatic?: boolean | null;
}
```

**Merged Exercise Type:**

Create helper type for UI consumption (combines base definition with overrides):

```typescript
export interface MergedExerciseDefinition extends ExerciseDefinitionClient {
    isOverridden: boolean; // True if any override exists
    overriddenFields: Set<string>; // Which fields are overridden
    originalExerciseDefId: string; // Reference to base definition
}
```

**Database Considerations:**
- Override fields are sparse (most exercises won't have overrides)
- No indexes needed on override fields
- Existing documents remain valid (undefined override fields = no override)
- When all overrides are cleared, set fields to `null` (not `undefined`) to distinguish "no override" from "never customized"

## API Changes

**Update AddPlanExerciseRequest** (`src/apis/plan-exercises/types.ts`):

```typescript
export interface AddPlanExerciseRequest {
    // ... existing fields ...
    
    // Optional override fields
    overrideName?: string;
    overrideImageUrl?: string;
    overridePrimaryMuscle?: string;
    overrideSecondaryMuscles?: string[];
    overrideType?: string;
    overrideIsBodyweight?: boolean;
    overrideIsStatic?: boolean;
}
```

**Update UpdatePlanExerciseRequest** (`src/apis/plan-exercises/types.ts`):

```typescript
export interface UpdatePlanExerciseRequest {
    // ... existing fields ...
    
    // Optional override fields (can be set to null to clear)
    overrideName?: string | null;
    overrideImageUrl?: string | null;
    overridePrimaryMuscle?: string | null;
    overrideSecondaryMuscles?: string[] | null;
    overrideType?: string | null;
    overrideIsBodyweight?: boolean | null;
    overrideIsStatic?: boolean | null;
}
```

**Update PlanExerciseWithDefinition** (`src/apis/plan-exercises/types.ts`):

```typescript
export interface PlanExerciseWithDefinition extends PlanExerciseClient {
    exerciseDef: ExerciseDefinitionClient; // Original definition
    
    // Merged definition (computed server-side for client convenience)
    mergedExerciseDef: {
        name: string;
        imageUrl: string;
        primaryMuscle: string;
        secondaryMuscles: string[];
        type: string;
        isBodyweight: boolean;
        isStatic: boolean;
        isOverridden: boolean;
        overriddenFields: string[]; // Array of field names that are overridden
    };
}
```

**Handler Changes:**

- **addPlanExercise.ts**: Accept override fields from request, validate (e.g., name not empty if provided), store in database
- **updatePlanExercise.ts**: Allow updating override fields, support setting to `null` to clear individual overrides
- **listPlanExercises.ts**: Compute `mergedExerciseDef` for each exercise by merging overrides with base definition

## State Management

**No global state needed** - All override data flows through existing React Query patterns:

- `useAddPlanExerciseMutation` - Update to pass override fields
- `useUpdatePlanExerciseMutation` - Update to pass override fields
- `usePlanExercises` - Query returns exercises with merged definitions

**Component state (ephemeral):**
- CustomizeExerciseDialog: Form state for override fields
- CustomizeExerciseSection: Collapsed/expanded state
- Modified field indicators: Track which fields differ from original

## Implementation Notes

**Merging Logic:**

Create utility function `mergeExerciseDefinition(baseDefinition, overrides)`:

```typescript
function mergeExerciseDefinition(
    base: ExerciseDefinitionClient,
    overrides: Partial<PlanExercise>
): MergedExerciseDefinition {
    const overriddenFields = new Set<string>();
    
    const getName = () => {
        if (overrides.overrideName !== undefined && overrides.overrideName !== null) {
            overriddenFields.add('name');
            return overrides.overrideName;
        }
        return base.name;
    };
    
    // Similar for other fields...
    
    return {
        ...base,
        name: getName(),
        // ... other merged fields
        isOverridden: overriddenFields.size > 0,
        overriddenFields,
        originalExerciseDefId: base._id,
    };
}
```

**UI Patterns:**

1. **Customized Badge**: Show on `PlanExerciseCard` when `mergedExerciseDef.isOverridden === true`
   - Small badge in top-right corner: "Customized" or pencil icon
   - Display merged values (not original)

2. **"Based on" Indicator**: Show original exercise name when customized
   - Below exercise name: "Based on: [Original Name]"
   - Only show if name is overridden

3. **Modified Field Indicators**: In CustomizeExerciseDialog
   - Each field shows "Modified" badge if it differs from original
   - Tapping badge shows original value + "Reset" button

4. **Reset All**: Confirmation dialog
   - "Reset all customizations? This will restore all fields to the original exercise definition values."
   - On confirm: Set all override fields to `null` via update API

**Image Upload:**

- Reuse existing CreateExerciseDialog image upload logic (base64 encoding)
- Store base64 image URL in `overrideImageUrl`
- Display override image in PlanExerciseCard and CustomizeExerciseDialog

**Validation:**

- Required fields (name, primaryMuscle) cannot be empty when overridden
- SecondaryMuscles cannot include primaryMuscle
- Image size validation (max 2MB, same as CreateExerciseDialog)

**Edge Cases:**

1. **Original exercise deleted**: If base exercise is deleted (custom exercise)
   - Plan exercise continues to work using overridden values
   - Show "(Deleted)" indicator where original name would appear
   - Disable "Reset to defaults" (no defaults to reset to)
   - Implementation: Check if `exerciseDef` is null in API response

2. **Partial overrides**: Most common case
   - User overrides only name, leaves everything else
   - UI shows "Modified" only on name field
   - Card displays customized name but original image/muscles

3. **Multiple instances**: Same exercise added twice with different overrides
   - Each PlanExercise has independent override fields
   - No special logic needed (already supported by schema)

**Muscle Groups List:**

Reuse MUSCLE_GROUPS constant from CreateExerciseDialog:

```typescript
const MUSCLE_GROUPS = [
    'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 
    'Forearms', 'Core', 'Abs', 'Quadriceps', 'Hamstrings',
    'Glutes', 'Calves', 'Full Body', 'Cardio'
];
```

## Implementation Plan

### Phase 1: Database Schema & API Foundation

1. Add override fields to PlanExercise interface in `src/server/database/collections/planExercises/types.ts`
2. Update PlanExerciseCreate and PlanExerciseUpdate types to include optional override fields
3. Update AddPlanExerciseRequest in `src/apis/plan-exercises/types.ts` to accept override fields
4. Update UpdatePlanExerciseRequest in `src/apis/plan-exercises/types.ts` to accept override fields (nullable)
5. Add MergedExerciseDefinition type and update PlanExerciseWithDefinition in `src/apis/plan-exercises/types.ts`
6. Create mergeExerciseDefinition utility function in `src/apis/plan-exercises/utils.ts`
7. Update addPlanExercise handler in `src/apis/plan-exercises/handlers/addPlanExercise.ts` to accept and store override fields
8. Update updatePlanExercise handler in `src/apis/plan-exercises/handlers/updatePlanExercise.ts` to support updating override fields
9. Update listPlanExercises handler in `src/apis/plan-exercises/handlers/listPlanExercises.ts` to compute mergedExerciseDef for each exercise
10. Run yarn checks to verify types and linting

### Phase 2: Display Overrides & Indicators

1. Update PlanExerciseCard to display merged exercise definition values instead of base definition
2. Add "Customized" badge to PlanExerciseCard when mergedExerciseDef.isOverridden is true
3. Add "Based on: [Original Name]" indicator to PlanExerciseCard when name is overridden
4. Update EditExerciseDialog header to show merged exercise info and customized indicator
5. Test that overridden exercises display correctly in the plan exercise list
6. Run yarn checks to verify

### Phase 3: Customize Exercise Interface

1. Create CustomizeExerciseDialog component at `src/client/routes/ManagePlan/components/exercises/CustomizeExerciseDialog.tsx`
   - Form fields for all override properties (name, image, muscles, type, bodyweight, static)
   - Modified field indicators with individual reset buttons
   - Reset All button with confirmation dialog
   - Image upload using CreateExerciseDialog pattern
2. Create CustomizeExerciseSection component at `src/client/routes/ManagePlan/components/exercises/CustomizeExerciseSection.tsx`
   - Expandable section with collapsed state by default
   - Embedded form fields for overrides
   - Same fields as CustomizeExerciseDialog but inline
3. Update AddExerciseDialog to integrate CustomizeExerciseSection
   - Add expandable section below workout config fields
   - Pass override data to addExercise mutation
4. Update ExerciseConfigForm to accept and display override section
   - Add prop for showing customize section
   - Pass override values to parent
5. Update EditExerciseDialog to add "Customize" button in header
   - Button opens CustomizeExerciseDialog
   - Pass current override values and merged definition
   - Save button calls updatePlanExercise with new override values
6. Implement reset functionality
   - Individual field reset: Set specific override field to null
   - Reset all: Set all override fields to null
   - Show confirmation dialog for reset all
7. Add "Deleted exercise" edge case handling
   - Detect when base exercise is null
   - Show "(Deleted)" indicator
   - Disable reset buttons
8. Test complete customization flow: add with overrides, edit overrides, reset individual field, reset all
9. Run yarn checks to verify