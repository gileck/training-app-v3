# Plan Import/Export & Sharing

Export, import, and share training plans for backup, collaboration, or migration between accounts.

## Overview

- **Export**: Save any plan to a JSON file or copy to clipboard
- **Import**: Load a JSON file and preview before creating the plan
- **Share**: Generate a shareable link for other users to preview and add the plan
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

## Import/Share Exercise Handling

When importing or adding a shared plan, exercises are handled automatically:

1. **Existing System Exercise**: If exercise name matches a system library exercise → uses existing
2. **Existing Custom Exercise**: If name matches a user's custom exercise → uses existing
3. **New Custom Exercise**: If no match found → creates as new custom exercise in user's library

This simplified flow uses `autoResolveUnmatched=true` - no manual resolution required.

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `training-plans/export` | POST | Required | Export a plan to JSON format |
| `training-plans/get-shared` | POST | None | Decode share token and fetch plan (public) |
| `training-plans/create-from-text` | POST | Required | Commit import/share (with autoResolveUnmatched) |

## Client Hooks

```typescript
import { 
    useExportPlan, 
    useCreatePlanFromText 
} from '@/client/routes/TrainingPlans/hooks';
import { exportDataToDraftPlan } from '@/client/routes/TrainingPlans/utils';

// Export a plan
const exportMutation = useExportPlan();
exportMutation.mutate({ planId: 'abc123' });

// Convert import data to draft (client-side, no server call)
const draftPlan = exportDataToDraftPlan(parsedJson);

// Commit with auto-resolve for custom exercises
const createMutation = useCreatePlanFromText();
createMutation.mutate({ 
    planName: draftPlan.planName,
    durationWeeks: draftPlan.durationWeeks,
    draft: draftPlan,
    autoResolveUnmatched: true  // Auto-create unmatched as custom exercises
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
4. Click "Continue" to preview plan
5. Click "Import Plan" to create (exercises auto-matched or created as custom)

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
│   ├── types.ts              # PlanExportData, GetSharedPlanRequest, etc.
│   ├── handlers/
│   │   ├── exportPlan.ts         # Export handler
│   │   ├── getSharedPlan.ts      # Shared plan public API handler
│   │   └── createPlanFromText.ts # Commit handler (with autoResolveUnmatched)
│   └── ...
└── client/routes/
    ├── TrainingPlans/
    │   ├── hooks.ts          # useExportPlan, useCreatePlanFromText
    │   ├── utils.ts          # exportDataToDraftPlan (shared utility)
    │   └── components/
    │       ├── ImportPlanDialog.tsx    # Import flow
    │       ├── SharePlanDialog.tsx     # Generate share URL
    │       ├── PlanPreview.tsx         # Shared preview UI
    │       └── PlanPreviewCommit.tsx   # Shared preview + commit
    └── SharedPlan/
        ├── SharedPlan.tsx    # Public route for /share/:token
        └── hooks.ts          # useSharedPlan
```

## Reused Components

The import and share flows reuse existing AI plan generation components:

- `PlanPreview` - Shows plan structure and exercise status
- `ExerciseResolver` - UI for matching unresolved exercises  
- `PlanPreviewCommit` - Shared component for preview, resolution, and commit
- `createPlanFromText` handler - Commits the draft to database

## Plan Sharing

Share plans with other users via a unique URL. The recipient can preview and add the plan to their account.

### How Sharing Works

1. **User A** clicks "Share" in plan menu → generates URL instantly (no server call)
2. URL format: `/share/{token}` where token = `base64url({ u: userId, p: planId })`
3. **User B** opens link → sees plan preview (public route, no auth required)
4. If logged in: "Add to My Plans" button
5. If not logged in: "Login to Add" button → login modal → auto-adds after login

### Share URL Token

The token encodes the plan owner's userId and planId:

```typescript
// Generate token (client-side)
const payload = JSON.stringify({ u: userId, p: planId });
const token = btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const url = `${origin}/share/${token}`;

// Example: https://app.com/share/eyJ1IjoiYWJjMTIzIiwicCI6Inh5ejc4OSJ9
```

### Custom Exercises

When User A shares a plan with custom exercises:
- Backend automatically matches by name against User B's library (system + custom exercises)
- If match found → uses existing exercise from User B's library
- If no match → creates new custom exercise for User B
- This is intentional: exercise definitions are per-user, so User A's changes don't affect User B

### Share API Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `training-plans/get-shared` | **None** | Decode token, fetch plan data (public API) |
| `training-plans/create-from-text` | Required | Commit plan with autoResolveUnmatched=true |

### Share vs Export

| Feature | Export | Share |
|---------|--------|-------|
| Format | JSON file | URL link |
| Recipient | Anyone with file | Anyone with link |
| Auth required to view | No | No |
| Auth required to add | Yes | Yes |
| Link expires | Never (file) | When plan deleted |
| Multiple users | Manual file sharing | Same link for all |
