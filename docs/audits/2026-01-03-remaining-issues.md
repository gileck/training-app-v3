# Remaining Audit Issues

Issues identified during the full project audit (2026-01-03) that were not addressed.

---

## 1. API Structure Issues

These API domains don't follow the standard structure (`index.ts`, `types.ts`, `server.ts`, `client.ts`, `handlers/`).

| Domain | Current State | Severity | Recommendation |
|--------|---------------|----------|----------------|
| `batch-updates` | Only `types.ts` | CRITICAL | Review if needed - may be handled via batch sync endpoint |
| `saved-workouts` | Only `handlers/` | CRITICAL | Add missing files or consolidate into another domain |
| `settings` | Only `handlers/clearCache/` | CRITICAL | Add proper structure if actively used |
| `chat` | Missing `handlers/` directory | MEDIUM | Add handlers/ or move logic |
| `plan-data` | Missing `client.ts` | MEDIUM | Add if client-side calls are needed |

### Investigation Needed

Before fixing, verify:
1. Are these APIs actively used?
2. Should they be consolidated into other domains?
3. Are they legacy code that can be removed?

---

## 2. Component Size Violations

Files exceeding the 150-line guideline for components.

| File | Lines | Severity | Suggested Extraction |
|------|-------|----------|---------------------|
| `routes/Progress/Progress.tsx` | 1,817 | CRITICAL | Extract: `ActivityLog`, `DailySummaries`, `ProgressCharts`, `EditActivityDialog`, `AddActivityDialog` |
| `routes/ActiveWorkout/ActiveWorkout.tsx` | 1,459 | CRITICAL | Extract: `AllExercisesOverlay`, timer hook |
| `routes/Home/Home.tsx` | 1,012 | CRITICAL | Extract: `ExerciseCard`, `PlanWorkoutCard` |
| `routes/Reports/Reports.tsx` | 791 | HIGH | Extract: `ReportCard` |

### Refactoring Strategy

For each file:
1. Identify logical sub-components (cards, dialogs, overlays)
2. Extract to `routes/[Route]/components/` directory
3. Extract shared hooks to `routes/[Route]/hooks.ts`
4. Keep main file as composition of extracted components

---

## 3. Completed Fixes (Reference)

These issues were fixed on 2026-01-03:

### Theming (5 instances)
- `PlanPreview.tsx` - 4 hardcoded orange colors → `warning` tokens
- `ExerciseResolver.tsx` - 1 hardcoded orange color → `warning` token

### MongoDB (5 files)
- `deleteReport.ts` - Direct ObjectId import → `isObjectIdFormat()`
- `syncPlanData.ts` - Direct ObjectId import → removed
- `deletePlanWorkout.ts` - Direct ObjectId import → `isObjectIdFormat()`
- `reorderPlanWorkouts.ts` - Direct ObjectId import → `isObjectIdFormat()`
- `updatePlanWorkout.ts` - Direct ObjectId import → removed

---

## 4. Areas Confirmed Compliant

No action needed for these areas:

| Area | Status |
|------|--------|
| Zustand Stores | 10/10 use `createStore` factory |
| React Query Mutations | 40/40 follow optimistic-only pattern |
| TypeScript | 0 violations (no `any` types) |
| shadcn/ui | 0 non-shadcn imports |
| Feature Organization | All properly structured |
| Loading State Patterns | Correctly implemented |
| Offline PWA Support | Production-ready |

---

## Priority Order for Remaining Work

1. **HIGH**: Component splitting (improves maintainability)
2. **MEDIUM**: API structure cleanup (after investigation)

Run `yarn checks` after any changes to verify compliance.
