---
number: 45
title: "Fix Template Audit Issues (2026-02-07)"
priority: High
size: L
complexity: Medium
status: DONE
dateAdded: 2026-02-07
planFile: task-manager/plans/task-45-plan.md
---

# Task 45: Fix Template Audit Issues (2026-02-07)

**Summary:** Fix all issues identified in the template-only audit report (audits/audit-2026-02-07.md). Includes 7 critical mutation violations, 5 high-priority temp ID and cache issues, 6 medium-priority database/API issues, 9 oversized components, and 2 low-priority documentation issues across 8 implementation phases.

## Completion Notes

7 of 8 phases completed. Merged to main in commit `9a180f8`.

| Phase | Status | Notes |
|-------|--------|-------|
| 1. Fix ItemDetail mutation violations | Done | Optimistic updates with rollback |
| 2. Fix FeatureRequests mutation violations | Done | Same pattern |
| 3. Replace temp IDs with generateId() | Done | Stable client-generated IDs |
| 4. Replace hardcoded cache values | Done | useQueryDefaults() |
| 5. Add batch database functions | Done | findByIds, batchUpdate, batchDelete |
| 6. Replace ObjectId with toQueryId() | Skipped | `toQueryId()` returns `ObjectId \| string`, incompatible with `$in: ObjectId[]`. Commented in code. |
| 7. Split oversized components | Done | 9 components split into sub-components |
| 8. Fix docs | Done | offline-pwa-support updated |
