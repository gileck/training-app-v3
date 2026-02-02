# Technical Design: Analytics Dashboard with Mock Data

## Overview

This technical design implements a comprehensive admin dashboard with analytics, interactive charts, real-time activity feed, and data export capabilities. Per the clarification, this implementation uses **simulated/mock data** derived from existing feature requests and bug reports, allowing rapid delivery of a fully functional dashboard without requiring backend instrumentation or real-time infrastructure.

## Implementation Approach

**Mock Data Strategy:**
- Generate realistic metrics from existing FeatureRequest and Report collections
- Simulate agent execution data (duration, cost, success rate) with random but realistic values
- Use polling (every 30s) to fetch updated data from existing collections for "real-time" effect
- All UI components and interactions are production-ready; only data layer is mocked

**Benefits:**
- Can be implemented immediately (2-3 days, L-sized)
- Demonstrates full dashboard capabilities for stakeholder feedback
- Foundation for real metrics when backend tracking is added
- No database schema changes required

## Size Estimation

**Overall Size:** L (Large)
- Estimated: 2-3 days of focused work
- 3 implementation phases (reducible from original 5 by using mock data)

## Architecture

### Frontend Architecture

**Route Structure:**
- New route: `/dashboard` - Main dashboard page
- Components organized under `src/client/routes/Dashboard/`

**Component Hierarchy:**
```
Dashboard (main page)
├── DashboardHeader (title, date range selector)
├── MetricsSection (4 metric cards with trends)
├── ChartsSection (4 interactive charts)
└── ActivityFeedSection (live activity timeline)
```

**State Management:**
- Zustand store for dashboard filters (date range, polling interval)
- React Query for data fetching with 30s polling
- Local state for chart interactions

**Data Fetching:**
- Existing collections: FeatureRequests, Reports
- New API endpoint: `/api/dashboard/analytics` (generates mock metrics)
- Polling every 30 seconds for "real-time" updates

### Backend Architecture

**New API Endpoint:**
- `GET /api/dashboard/analytics?startDate=...&endDate=...`
- Returns: Aggregated metrics + simulated agent data
- Mock data generation happens server-side for consistency

**Mock Data Generation:**
```typescript
// Simulated agent execution metrics
{
  totalExecutions: 156,
  successRate: 94.5,
  avgDuration: 204000, // ms (3m 24s)
  totalCost: 45.67,
  costBreakdown: {
    'tech-design': 12.34,
    'implement': 28.90,
    'pr-review': 4.43
  }
}
```

## Implementation Phases

### Phase 1: Dashboard Layout & Core Infrastructure
**Estimated Size:** M
**Timeline:** Day 1

**Files to Create:**
- `src/client/routes/Dashboard/Dashboard.tsx` - Main dashboard page
- `src/client/routes/Dashboard/hooks.ts` - React Query hooks
- `src/client/routes/Dashboard/store.ts` - Zustand store for filters
- `src/client/routes/Dashboard/types.ts` - TypeScript types
- `src/client/routes/Dashboard/components/DashboardHeader.tsx` - Header with date picker
- `src/client/routes/Dashboard/components/DashboardSkeleton.tsx` - Loading state
- `src/pages/api/dashboard/analytics.ts` - Backend API endpoint

**Files to Modify:**
- `src/client/components/NavLinks.tsx` - Add dashboard navigation item
- `src/client/router.tsx` - Add `/dashboard` route

**Implementation Details:**

1. **Dashboard Route (`Dashboard.tsx`):**
   - Responsive grid layout (1 col mobile, 2-3 cols desktop)
   - Date range state management
   - Loading skeleton while data fetches
   - Error boundary for graceful failures

2. **API Endpoint (`/api/dashboard/analytics.ts`):**
   - Accept `startDate` and `endDate` query params
   - Query FeatureRequests and Reports collections
   - Calculate real metrics (counts, status distribution)
   - Generate simulated agent metrics (randomized but consistent per time range)
   - Return combined analytics object

3. **Date Range Selector:**
   - Pre-defined ranges: Last 7 days, Last 30 days, Last 90 days, All time
   - Custom range picker using `react-day-picker`
   - Default: Last 30 days

4. **Navigation:**
   - Add Dashboard icon (BarChart3 from lucide-react)
   - Position: Admin section in drawer menu
   - Show for admin users only (use existing auth patterns)

### Phase 2: Metrics Cards & Interactive Charts
**Estimated Size:** M
**Timeline:** Day 2

**Files to Create:**
- `src/client/routes/Dashboard/components/MetricsSection.tsx` - Grid of metric cards
- `src/client/routes/Dashboard/components/MetricCard.tsx` - Reusable card component
- `src/client/routes/Dashboard/components/ChartsSection.tsx` - Charts container
- `src/client/routes/Dashboard/components/FeatureRequestsChart.tsx` - Line chart (requests over time)
- `src/client/routes/Dashboard/components/StatusDistributionChart.tsx` - Pie chart (status breakdown)
- `src/client/routes/Dashboard/components/AgentPerformanceChart.tsx` - Bar chart (agent comparison)
- `src/client/routes/Dashboard/components/CostBreakdownChart.tsx` - Stacked bar chart (costs by phase)
- `src/client/routes/Dashboard/utils/chartConfig.ts` - Recharts theme/config
- `src/client/routes/Dashboard/utils/mockData.ts` - Mock data generators

**Implementation Details:**

1. **Metric Cards (4 cards):**
   - **Feature Requests Card:**
     - Total count with trend indicator (+12.5% vs previous period)
     - Breakdown: 45 pending, 12 in-progress, 78 completed
     - Icon: Lightbulb
     - Color: Blue
   
   - **Bug Reports Card:**
     - Total count with trend (-8.3% - good!)
     - Breakdown: 5 new, 3 investigating, 42 resolved
     - Icon: Bug
     - Color: Red
   
   - **Agent Success Rate Card:**
     - Percentage with trend (94.5%, +2.1%)
     - Subtext: "156 executions"
     - Icon: CheckCircle
     - Color: Green
   
   - **Total Cost Card:**
     - Dollar amount with trend ($45.67, +5.2%)
     - Subtext: "Avg $0.29 per execution"
     - Icon: DollarSign
     - Color: Purple

   - **Trend Calculation:**
     - Compare current period vs previous period of same length
     - Show up/down arrow with percentage
     - Color code: green for positive trends (except costs), red for negative

2. **Charts Library Setup:**
   - Use `recharts` (already in package.json)
   - Consistent color palette matching app theme
   - Responsive sizing with `ResponsiveContainer`
   - Tooltips with formatted values
   - Legend for multi-series charts

3. **Feature Requests Over Time (Line Chart):**
   - X-axis: Date (grouped by day/week/month based on range)
   - Y-axis: Count
   - Three lines: Created, Completed, In Progress
   - Smooth curve interpolation
   - Mock: Generate daily counts with slight upward trend

4. **Status Distribution (Pie Chart):**
   - Segments: New, In Progress, Done, Rejected
   - Show percentage and count in legend
   - Colors match existing StatusBadge colors
   - Mock: Use actual counts from FeatureRequests

5. **Agent Performance Comparison (Bar Chart):**
   - X-axis: Agent type (tech-design, implement, pr-review)
   - Y-axis: Average duration (seconds)
   - Grouped bars: Success rate (%) and Avg duration
   - Mock: tech-design (3m 20s, 96%), implement (5m 45s, 93%), pr-review (1m 50s, 97%)

6. **Cost Breakdown by Phase (Stacked Bar Chart):**
   - X-axis: Time periods (weeks/months)
   - Y-axis: Cost ($)
   - Stacked segments: tech-design, implement, pr-review, other
   - Tooltip shows cost + percentage of total
   - Mock: Generate weekly/monthly totals with realistic variation

### Phase 3: Activity Feed & Data Export
**Estimated Size:** S
**Timeline:** Day 3

**Files to Create:**
- `src/client/routes/Dashboard/components/ActivityFeedSection.tsx` - Activity timeline
- `src/client/routes/Dashboard/components/ActivityItem.tsx` - Single activity row
- `src/client/routes/Dashboard/components/ExportButton.tsx` - CSV export button
- `src/client/routes/Dashboard/utils/exportToCsv.ts` - CSV generation utility
- `src/client/routes/Dashboard/utils/generateActivities.ts` - Mock activity generator

**Implementation Details:**

1. **Activity Feed:**
   - Scrollable timeline showing recent events (last 50)
   - Event types:
     - Feature request created/approved/completed
     - Bug report submitted/resolved
     - Agent execution started/completed/failed
     - PR created/merged
   
   - **Activity Item Structure:**
     ```typescript
     {
       id: string;
       type: 'feature_request' | 'bug_report' | 'agent_execution' | 'pr';
       action: 'created' | 'approved' | 'completed' | 'failed' | 'merged';
       title: string; // e.g., "Feature request approved: Add dark mode"
       timestamp: Date;
       metadata: {
         agentType?: string;
         duration?: number;
         cost?: number;
         status?: string;
       };
     }
     ```
   
   - **Mock Data Source:**
     - Fetch recent FeatureRequests and Reports
     - For each item, generate 1-3 activity events (created → completed)
     - Simulate agent executions with random timestamps
     - Sort by timestamp descending
   
   - **Polling for "Real-time":**
     - React Query with `refetchInterval: 30000` (30s)
     - Show subtle badge when new activities arrive
     - Smooth scroll animation for new items

   - **Filtering:**
     - Filter buttons: All, Features, Bugs, Agents, PRs
     - Stored in Zustand (persisted to localStorage)

   - **Styling:**
     - Timeline with left border line
     - Icons for each activity type
     - Relative timestamps ("2 minutes ago", "1 hour ago")
     - Color coding by status (success = green, failed = red)

2. **CSV Export:**
   - Export button in DashboardHeader
   - Generates CSV with all current dashboard data
   - Sections:
     - Summary metrics
     - Feature requests list
     - Bug reports list
     - Agent executions (mocked)
   
   - **CSV Structure:**
     ```csv
     Dashboard Analytics Export
     Date Range: 2026-01-03 to 2026-02-02
     
     SUMMARY METRICS
     Total Feature Requests,135
     Total Bug Reports,50
     Agent Success Rate,94.5%
     Total Cost,$45.67
     
     FEATURE REQUESTS
     ID,Title,Status,Created,Completed
     ...
     
     BUG REPORTS
     ID,Description,Status,Created,Resolved
     ...
     
     AGENT EXECUTIONS (SIMULATED)
     Timestamp,Agent Type,Duration (s),Cost ($),Status
     ...
     ```
   
   - **Implementation:**
     - Use simple string concatenation (no external lib needed)
     - Trigger browser download with `data:text/csv` URI
     - Filename: `dashboard-export-YYYY-MM-DD.csv`
     - Show toast notification on success

## Data Models

### API Response Type

**Dashboard Analytics Response:**
```typescript
// src/client/routes/Dashboard/types.ts

export interface DashboardMetrics {
  // Real data from database
  featureRequests: {
    total: number;
    byStatus: {
      new: number;
      in_progress: number;
      done: number;
      rejected: number;
    };
    trend: number; // percentage change vs previous period
  };
  
  bugReports: {
    total: number;
    byStatus: {
      new: number;
      investigating: number;
      resolved: number;
      closed: number;
    };
    trend: number;
  };
  
  // Simulated agent metrics
  agentMetrics: {
    totalExecutions: number;
    successRate: number; // 0-100
    avgDuration: number; // milliseconds
    successRateTrend: number;
  };
  
  costs: {
    total: number;
    avgPerExecution: number;
    byAgentType: {
      [agentType: string]: number;
    };
    trend: number;
  };
  
  // Time series data for charts
  timeSeries: {
    featureRequestsByDay: Array<{
      date: string; // ISO date
      created: number;
      completed: number;
      inProgress: number;
    }>;
    
    costsByWeek: Array<{
      weekStart: string; // ISO date
      techDesign: number;
      implement: number;
      prReview: number;
      other: number;
    }>;
  };
  
  // Agent performance comparison
  agentPerformance: Array<{
    agentType: string;
    avgDuration: number; // seconds
    successRate: number; // 0-100
    executionCount: number;
  }>;
}

export interface Activity {
  id: string;
  type: 'feature_request' | 'bug_report' | 'agent_execution' | 'pr';
  action: 'created' | 'approved' | 'completed' | 'failed' | 'merged' | 'resolved';
  title: string;
  timestamp: string; // ISO string
  metadata?: {
    agentType?: string;
    duration?: number; // seconds
    cost?: number;
    status?: string;
  };
}

export interface DashboardFilters {
  startDate: Date;
  endDate: Date;
  activityTypeFilter: 'all' | 'feature_request' | 'bug_report' | 'agent_execution' | 'pr';
}
```

### Zustand Store

```typescript
// src/client/routes/Dashboard/store.ts

interface DashboardStore {
  // Filters
  startDate: Date;
  endDate: Date;
  activityTypeFilter: Activity['type'] | 'all';
  
  // Actions
  setDateRange: (start: Date, end: Date) => void;
  setActivityTypeFilter: (filter: Activity['type'] | 'all') => void;
  
  // Presets
  setLast7Days: () => void;
  setLast30Days: () => void;
  setLast90Days: () => void;
  setAllTime: () => void;
}
```

## Mock Data Generation Strategy

**Server-Side Generation (`/api/dashboard/analytics.ts`):**

1. **Query Real Data:**
   - Fetch FeatureRequests with date filter
   - Fetch Reports with date filter
   - Calculate real counts and distributions

2. **Generate Simulated Agent Metrics:**
   - Use deterministic randomization (seed based on date range)
   - Ensures consistent results for same date range
   - Realistic ranges:
     - Success rate: 92-97%
     - Avg duration: 2-6 minutes
     - Cost per execution: $0.10 - $0.50
     - Total cost: (feature request count × 3 agents) × avg cost

3. **Generate Time Series:**
   - For feature requests: Group by day/week
   - For costs: Weekly aggregation
   - Add slight noise for realism

4. **Generate Activities:**
   - For each FeatureRequest: 1-3 events (created, approved, completed)
   - For each Report: 1-2 events (created, resolved)
   - Simulate agent executions: 3 per completed feature request
   - Sort by timestamp descending
   - Return last 100 activities

**Seeded Randomization:**
```typescript
// Consistent random values based on date range
function seededRandom(seed: string): number {
  // Simple hash-based pseudo-random (0-1)
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(Math.sin(hash));
}

// Usage:
const seed = `${startDate.toISOString()}-${endDate.toISOString()}`;
const baseSuccessRate = 93 + (seededRandom(seed) * 4); // 93-97%
```

## User Experience Enhancements

**Loading States:**
- Skeleton loaders for all sections
- Individual skeletons for each metric card
- Chart placeholders with shimmer effect
- Graceful degradation if data fetch fails

**Empty States:**
- "No data for this time range" when date range has no activity
- Friendly illustrations (use existing empty state patterns)
- Suggestions: "Try expanding the date range" or "View all time"

**Error Handling:**
- Toast notification on API errors
- Retry button for failed fetches
- Fallback to cached data if available (React Query)

**Responsive Design:**
- Mobile: Single column layout, stacked charts
- Tablet: 2-column grid
- Desktop: 3-column grid for metrics, 2-column for charts
- Charts resize smoothly with `ResponsiveContainer`

**Performance:**
- Lazy load charts (only render when scrolled into view)
- Debounce date range changes (500ms)
- Memoize expensive calculations
- React Query caching (5 min stale time)

**Accessibility:**
- Semantic HTML (article, section, h2/h3 headings)
- ARIA labels for charts
- Keyboard navigation for date picker
- Focus management for export dialog

## Testing Strategy

**Manual Testing Checklist:**
1. Date range selection (presets + custom)
2. Metrics update when date range changes
3. Charts render correctly on all screen sizes
4. Activity feed polling works (see updates after 30s)
5. Activity type filtering works
6. CSV export downloads correctly
7. Loading states display properly
8. Error states handle API failures gracefully
9. Works for admin users, hidden for regular users
10. Theme switching (dark/light mode)

**Data Validation:**
- Metrics are consistent with selected date range
- Trend percentages are correctly calculated
- Chart data matches metric card totals
- Activities are sorted by timestamp
- No duplicate activity IDs

## Migration Path to Real Data

**When real agent tracking is implemented:**

1. **Backend Changes:**
   - Create new collection: `agent_executions`
   - Add execution logging to agents
   - Update `/api/dashboard/analytics` to query real data
   - Remove mock data generation

2. **Frontend Changes:**
   - Update types if schema differs
   - No component changes needed (same data shape)
   - Update documentation

3. **Feature Additions:**
   - Real-time WebSocket updates (replace polling)
   - PDF export with charts
   - Email scheduled reports
   - Custom dashboard views

**Estimated Migration Effort:** S (1-2 days)

## Dependencies

**New Dependencies:**
- None (recharts already in package.json)

**Existing Dependencies Used:**
- `recharts` - Chart library
- `react-day-picker` - Date range picker
- `lucide-react` - Icons
- `date-fns` - Date formatting
- `@tanstack/react-query` - Data fetching
- `zustand` - State management

## Rollout Plan

**Phase 1: Internal Testing**
- Deploy to staging
- Admin team reviews dashboard
- Gather feedback on metrics and UX

**Phase 2: Soft Launch**
- Enable for admin users only
- Monitor performance and errors
- Iterate on any issues

**Phase 3: Full Launch**
- Announce to all admin users
- Create documentation/walkthrough
- Plan for real data migration

## Success Metrics

**User Adoption:**
- 80%+ of admin users visit dashboard within 1 week
- Average 3+ visits per admin user per week

**Technical Performance:**
- Dashboard loads in < 2 seconds
- Charts render in < 500ms
- No client-side errors

**Feedback:**
- Positive feedback from stakeholders on UX
- Clear requests for real data indicate value

## Security Considerations

**Access Control:**
- Dashboard restricted to admin users (check in route guard)
- API endpoint validates admin role
- No sensitive data exposed (costs are simulated)

**Data Privacy:**
- Activity feed shows only titles, no user PII
- Bug reports aggregated only, no full details
- CSV export includes same data as UI (no additional exposure)

## Documentation

**User Documentation:**
- Add dashboard section to admin guide
- Explain what metrics are real vs simulated
- Guide on date range selection and filtering

**Developer Documentation:**
- Comment in code: "TODO: Replace with real agent metrics"
- Document mock data generation logic
- Migration guide for real data integration

## Open Questions & Future Enhancements

**Future Enhancements (Post-MVP):**
- Real-time updates via WebSocket/SSE
- PDF export with chart images
- Scheduled email reports
- Custom dashboard widgets (drag-and-drop)
- Drill-down views (click metric → see details)
- Comparison mode (compare two date ranges)
- Agent execution detail page (view individual runs)

**Not in Scope:**
- Real agent execution tracking (future work)
- Cost tracking integration with API providers (future work)
- PDF generation (CSV only for MVP)
- Email scheduling (manual export only)

## Conclusion

This design delivers a production-ready analytics dashboard in 2-3 days using mock data. It provides immediate value to stakeholders while establishing the foundation for real metrics when backend tracking is implemented. The dashboard demonstrates full capabilities including interactive charts, activity feeds, and data export, enabling informed decisions about further investment in comprehensive analytics infrastructure.