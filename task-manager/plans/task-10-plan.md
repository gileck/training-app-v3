# Task 10: Add Cost Budgeting and Alerts - Implementation Plan

## Objective

Implement incremental cost summary that updates after each agent phase completes, showing running totals and alerting when budget thresholds are exceeded.

## Approach

**Incremental Cost Summary Strategy:**
Each agent automatically updates a cumulative `## Summary` section at the end of the log file after it completes. The summary grows incrementally:
- Product Design adds itself → Total: $0.34
- Tech Design adds itself → Total: $1.00
- Implementation adds itself → Total: $1.91
- PR Review adds itself → Total: $3.58 (Final)

This provides real-time visibility into costs and allows early budget alerts.

## Sub-tasks

- [ ] Add budget configuration to `src/agents/shared/config.ts`
- [ ] Create cost summary utilities in `src/agents/lib/logging/cost-summary.ts`
  - Parse existing summary from log file
  - Calculate running totals
  - Generate summary markdown
  - Check budget thresholds
- [ ] Add read function to `src/agents/lib/logging/writer.ts`
- [ ] Update `logExecutionEnd()` in `src/agents/lib/logging/logger.ts` to call cost summary update
- [ ] Add cost summary types to `src/agents/lib/logging/types.ts`
- [ ] Test with existing agent logs
- [ ] Run validation checks

## Files to Create

- `src/agents/lib/logging/cost-summary.ts` - New module for cost summary logic

## Files to Modify

- `src/agents/shared/config.ts` - Add budget configuration
- `src/agents/lib/logging/writer.ts` - Add `readLog()` function
- `src/agents/lib/logging/logger.ts` - Update `logExecutionEnd()` to call summary update
- `src/agents/lib/logging/types.ts` - Add `PhaseData` type
- `src/agents/lib/logging/index.ts` - Export new cost summary functions

## Implementation Details

### Budget Configuration

```typescript
// In config.ts
export interface BudgetConfig {
    warningThresholdUSD: number;
    alertThresholdUSD: number;
    telegramAlertsEnabled: boolean;
}

export const budgetConfig: BudgetConfig = {
    warningThresholdUSD: 5.00,
    alertThresholdUSD: 10.00,
    telegramAlertsEnabled: true,
};
```

### Cost Summary Module

Key functions in `cost-summary.ts`:
1. `parseCostSummary(logContent: string): PhaseData[]` - Extract existing phases from log
2. `updateCostSummary(ctx, currentPhase)` - Main function called after each agent
3. `generateSummaryMarkdown(phases, totalCost, budgetConfig)` - Create markdown table
4. `checkBudgetThreshold(totalCost, issueNumber, budgetConfig)` - Send alerts if needed

### Summary Format

```markdown
## Summary (Updated after Tech Design)

| Phase | Duration | Tools | Tokens | Cost |
|-------|----------|-------|--------|------|
| Product Design | 4m 32s | 15 | 2,341 | $0.3421 |
| Tech Design | 6m 18s | 22 | 4,512 | $0.6583 |
| **Total** | **10m 50s** | **37** | **6,853** | **$1.0004** |

**Last Updated:** 14:28:33
✅ **Cost Status:** Within budget (Alert threshold: $10.00)
```

### Integration Point

In `logExecutionEnd()`, after writing phase result:

```typescript
export function logExecutionEnd(ctx: LogContext, summary: Partial<ExecutionSummary>): void {
    // ... existing code ...

    appendToLog(ctx.issueNumber, content);

    // NEW: Update cumulative cost summary
    updateCostSummary(ctx, {
        name: ctx.phase,
        duration,
        toolCallsCount: summary.toolCallsCount || 0,
        totalTokens: summary.totalTokens || 0,
        totalCost: summary.totalCost || 0,
    });

    console.log(`  📝 Agent log saved: ${getLogPath(ctx.issueNumber)}`);
}
```

## Testing Strategy

1. Check existing agent logs to verify format
2. Test parsing logic on real log files
3. Test summary update with mock data
4. Verify budget alerts trigger at correct thresholds
5. Confirm Telegram notifications work

## Validation

- Run `yarn checks` to ensure TypeScript and ESLint pass
- Verify no breaking changes to existing logging behavior
- Test that summary updates correctly after each phase
