# Plan Import/Export

Export and import training plans as JSON files for backup, sharing, or migration between accounts.

## Overview

- **Export**: Save any plan to a JSON file or copy to clipboard
- **Import**: Load a JSON file and preview before creating the plan
- **Exercise Matching**: Automatically matches exercises to your library using ID or name

## Export Format

```json
{
  "version": "1.0",
  "planName": "Push Pull Legs",
  "durationWeeks": 8,
  "workouts": [
    {
      "name": "Push Day",
      "exercises": [
        {
          "name": "Barbell Bench Press",
          "exerciseDefId": "507f1f77bcf86cd799439011",
          "sets": 4,
          "reps": 8,
          "weightKg": 60,
          "notes": "Keep back flat"
        }
      ]
    }
  ]
}
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `version` | Yes | Format version (currently "1.0") |
| `planName` | Yes | Plan name (1-100 characters) |
| `durationWeeks` | Yes | Duration in weeks (1-52) |
| `workouts` | Yes | Array of workouts (1-50) |
| `workouts[].name` | Yes | Workout name |
| `workouts[].exercises` | Yes | Array of exercises (at least 1) |
| `exercises[].name` | Yes | Exercise name |
| `exercises[].exerciseDefId` | No | For fast matching on re-import |
| `exercises[].sets` | No | Number of sets (1-20) |
| `exercises[].reps` | No | Number of reps (0-100) |
| `exercises[].durationSeconds` | No | Duration for timed exercises |
| `exercises[].weightKg` | No | Weight in kg |
| `exercises[].notes` | No | Exercise notes |

## Import Matching Strategy

When importing, exercises are matched in this order:

1. **ID Match**: If `exerciseDefId` exists and matches an exercise in your library → instant match
2. **Name Match**: Falls back to fuzzy name matching using the same algorithm as AI plan generation
3. **Unresolved**: If no match found, user must manually resolve before importing

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `training-plans/export` | GET | Export a plan to JSON format |
| `training-plans/match-imported` | POST | Match imported exercises and get preview |
| `training-plans/create-from-text` | POST | Commit the import (reused from AI flow) |

## Client Hooks

```typescript
import { 
    useExportPlan, 
    useMatchImportedPlan,
    useCreatePlanFromText 
} from '@/client/routes/TrainingPlans/hooks';

// Export a plan
const exportMutation = useExportPlan();
exportMutation.mutate({ planId: 'abc123' });

// Match imported plan
const matchMutation = useMatchImportedPlan();
matchMutation.mutate({ importData: parsedJson });

// Commit (same as AI flow)
const createMutation = useCreatePlanFromText();
createMutation.mutate({ 
    planName: draft.planName,
    durationWeeks: draft.durationWeeks,
    draft 
});
```

## UI Flow

### Export

1. Click plan options menu (⋮) → "Export JSON"
2. Choose: "Save as File" or "Copy JSON"
3. File downloads or JSON copied to clipboard

### Import

1. Click "New Plan" → "Import from JSON"
2. Paste JSON or upload file
3. Real-time validation shows errors
4. Click "Continue" to preview
5. Resolve any unmatched exercises (same UI as AI plan)
6. Click "Import Plan" to create

## Error Handling

### Export Errors

| Error | Message |
|-------|---------|
| Plan not found | "This plan no longer exists. It may have been deleted." |
| Unauthorized | "Not authenticated" |
| Server error | "Failed to export plan. Please try again." |

### Import Errors

| Error | Message |
|-------|---------|
| Invalid JSON | "Invalid JSON format. {details}" |
| Missing version | "Invalid plan format. Missing required field: `version`" |
| Unsupported version | "This plan was exported from an unsupported version." |
| Empty workouts | "This plan has no workouts." |
| Too many exercises | "Too many exercises (maximum 200)." |
| Clipboard denied | "Clipboard access denied. Please paste manually." |

## File Structure

```
src/
├── apis/training-plans/
│   ├── types.ts              # PlanExportData, ExportPlanRequest, etc.
│   ├── handlers/
│   │   ├── exportPlan.ts     # Export handler
│   │   └── matchImportedPlan.ts  # Import matching handler
│   └── ...
└── client/routes/TrainingPlans/
    ├── hooks.ts              # useExportPlan, useMatchImportedPlan
    └── components/
        └── ImportPlanDialog.tsx  # Two-step import dialog
```

## Reused Components

The import flow reuses existing AI plan generation components:

- `AiPlanPreview` - Shows plan structure and exercise status
- `ExerciseResolver` - UI for matching unresolved exercises  
- `createPlanFromText` handler - Commits the draft to database
