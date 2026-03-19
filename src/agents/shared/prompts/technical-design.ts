/**
 * Technical Design Prompts
 *
 * Prompts for the Technical Design phase that defines HOW to implement
 * the feature from a technical perspective.
 */

import type { ProjectItemContent } from '@/server/template/project-management';
import type { GitHubComment } from '../types';
import {
    AMBIGUITY_INSTRUCTIONS,
    MARKDOWN_FORMATTING_INSTRUCTIONS,
    READ_ONLY_MODE_INSTRUCTIONS,
    FEEDBACK_HISTORY_INSTRUCTIONS,
    buildCommentsSection,
    buildFeedbackSection,
    buildIssueDetailsHeader,
    formatCommentsList,
} from './shared-instructions';

/**
 * Build prompt for generating a new technical design
 */
export function buildTechDesignPrompt(issue: ProjectItemContent, productDesign: string | null, comments?: GitHubComment[]): string {
    const productDesignSection = productDesign
        ? `## Approved Product Design

${productDesign}`
        : `## Note
No product design phase for this item (internal/technical work). Base your technical design on the issue description.`;

    const commentsSection = buildCommentsSection(comments);

    return `You are creating a Technical Design document for a GitHub issue.${productDesign ? ' The Product Design has been approved, and now you need to define the technical implementation.' : ' This is internal/technical work that skipped the product design phase.'}

${READ_ONLY_MODE_INSTRUCTIONS}

${buildIssueDetailsHeader(issue, { descriptionLabel: 'Original Description' })}
${commentsSection}
${productDesignSection}

## Your Task

Create a Technical Design document. The size of your output should match the complexity of the feature - simple features get simple designs, complex features get detailed designs.

**Required sections:**
1. **Size & Complexity** - Effort (S/M/L/XL) and complexity (Low/Medium/High)
2. **Overview** - Brief technical approach (1-2 sentences for small features)
3. **Files to Create/Modify** - List of files with brief description of changes

## Size Estimation Criteria

Use these criteria to determine the appropriate size. **Size is about total effort, NOT about which layers are touched.** A feature needing schema + API + UI is completely normal for M size.

**S (Small)** - Few hours of work
- Simple, focused change
- Examples: Add button, fix styling, update text, add field to existing form

**M (Medium)** - 1-2 days of work (SINGLE PR)
- Standard feature with straightforward implementation
- Can include: new collection, CRUD APIs, new route with components
- Examples: Add notes feature (collection + 4 endpoints + list/form UI), new settings page, simple entity management

**L (Large)** - 3-5 days of work (REQUIRES PHASES)
- Complex feature with significant logic or many edge cases
- Multiple interconnected components with complex state
- Examples: Advanced filtering/search system, complex multi-step wizard, feature with extensive validation rules

**XL (Epic)** - Week+ of work (REQUIRES PHASES)
- Major new capability or system
- Significant architectural decisions
- Examples: Real-time collaboration, complex integrations, major workflow system

**Key insight:** A feature with schema + API + UI is typically M size (single PR). Only split into phases when the TOTAL work is genuinely large, not because it touches multiple layers.

**Optional sections (include only when relevant):**
- **Data Model** - Only if new collections or schema changes needed
- **API Changes** - Only if new endpoints or modifications needed
- **State Management** - Only if non-trivial state handling needed
- **Implementation Notes** - Only for complex logic that needs explanation

## Multi-PR Workflow (for L/XL features ONLY)

**CRITICAL: For L or XL size features, you MUST split the implementation into phases.**

Each phase:
- Should be independently mergeable (can be deployed on its own)
- Should be size S or M (not L or XL)
- Should result in a single PR
- Should have clear dependencies (which phases must complete before this one)

If the feature is L or XL:
1. Split it into 2-5 implementation phases
2. Each phase should be a complete, testable unit of work
3. Order phases so earlier phases don't depend on later ones
4. Include the phases in your structured output

**Phase Breakdown Strategy:**

**IMPORTANT:** Do NOT split by layer (database → API → UI). A typical M-size feature includes all layers in ONE PR.

Only split into phases when the feature is genuinely L/XL. When you do split, split by **complexity levels** - each phase delivers a WORKING end-to-end feature, just at increasing sophistication.

**Phase split by complexity (CORRECT approach):**
- **Phase 1: Foundation** - Simple working version (basic schema + basic API + basic UI). Not production-polished, but functional end-to-end.
- **Phase 2: Add Complexity** - Richer fields, more endpoints, better UI, handle more cases
- **Phase 3: More Complexity** - Advanced features, edge cases, polish, optimizations

**Bad phase split (by layer - DON'T DO THIS):**
- Phase 1: Just database schema - nothing works yet
- Phase 2: Just API endpoints - still nothing usable
- Phase 3: Just UI - finally works

**Example: Notifications System (L/XL)**

- **Phase 1: Foundation**
  - Schema: Basic fields (message, read, createdAt)
  - API: list, markRead
  - UI: Simple list
  - What Works: User can see and mark notifications

- **Phase 2: Add Complexity**
  - Schema: Add types, priority, actions
  - API: filtering, markAllRead, delete
  - UI: Filters, actions, badges
  - What Works: Richer notification experience

- **Phase 3: Advanced**
  - Schema: Add channels, preferences
  - API: real-time, preferences API
  - UI: Real-time updates, settings
  - What Works: Full-featured system

Each phase is independently mergeable, deployable, and delivers increasing value.

**Example: When to use phases vs single PR**

- **Notes feature (collection + CRUD + UI)** - Size: M, Phases: No
  - Reasoning: Standard pattern, 1-2 days work
- **User preferences page** - Size: M, Phases: No
  - Reasoning: Straightforward settings UI
- **Complex notifications with types, real-time, preferences** - Size: L, Phases: Yes
  - Reasoning: High complexity, split by sophistication
- **Multi-step workflow builder** - Size: XL, Phases: Yes
  - Reasoning: Very complex, needs incremental delivery

**IMPORTANT**: Only include phases for L/XL features. For S/M features, do NOT include phases - they will be implemented in a single PR.

## Research Strategy

Explore the codebase:
1. Read existing similar features to understand patterns
2. Check \`src/apis/\` for API patterns
3. Check \`src/server/database/collections/\` for database patterns
4. Look at \`src/client/routes/\` for component patterns

**Data availability check**: Before specifying UI that displays data, verify the schema/types have the required fields. If missing, note "requires schema change" or remove the feature from design.

## Output Format

Provide your response as structured JSON with these fields:
- **design**: Complete Technical Design document in markdown format (same structure as before)
- **phases** (L/XL features ONLY): Array of implementation phases (see schema below). Leave empty/null for S/M features.
- **comment**: High-level implementation plan to post as GitHub comment (3-5 bullet points). Use markdown numbered list with each item on a NEW LINE

**Phase schema (for L/XL features only):**
\`\`\`json
{
  "order": 1,                    // Phase number (1, 2, 3, etc.)
  "name": "Database Schema",     // Short phase name
  "description": "...",          // What this phase implements
  "files": ["src/...", "docs/..."],  // Source files to modify + relevant docs
  "estimatedSize": "S"           // S or M (never L/XL for a single phase)
}
\`\`\`

**IMPORTANT - Files Array Content:**
The \`files\` array should include BOTH:
1. **Source files to create/modify** - The actual implementation files (e.g., \`src/apis/...\`, \`src/client/...\`)
2. **Relevant documentation** - Docs the implementor should read before implementing this phase:
   - \`docs/\` files for detailed patterns (e.g., \`docs/mongodb-usage.md\`, \`docs/theming.md\`)
   - \`docs/template/project-guidelines/\` files for coding guidelines (e.g., \`docs/template/project-guidelines/state-management-guidelines.md\`)

Select docs based on what the phase touches:
- Database work → \`docs/template/mongodb-usage.md\`, \`docs/template/project-guidelines/mongodb-usage.md\`
- API endpoints → \`docs/template/api-endpoint-format.md\`, \`docs/template/project-guidelines/client-server-communications.md\`
- UI components → \`docs/template/theming.md\`, \`docs/template/project-guidelines/react-component-organization.md\`, \`docs/template/project-guidelines/shadcn-usage.md\`
- State management → \`docs/template/state-management.md\`, \`docs/template/project-guidelines/state-management-guidelines.md\`
- Authentication → \`docs/template/authentication.md\`, \`docs/template/project-guidelines/user-access.md\`
- Offline/PWA → \`docs/offline-pwa-support.md\`, \`docs/react-query-mutations.md\`

Keep the design concise. A small feature might only need a short list of files. A large feature needs more detail.

## Implementation Plan Section (REQUIRED)

Your technical design MUST include a "## Implementation Plan" section with high-level, actionable steps.

**For S/M features (single-phase):**
- Provide a single numbered list of implementation steps
- Each step should be a clear, actionable task
- Include file paths and what to do with them
- Order steps so each builds on the previous

**For L/XL features (multi-phase):**
- Organize steps by phase
- Each phase should have its own numbered list
- Steps within a phase should be self-contained

**Step guidelines:**
- Keep steps high-level (not line-by-line detailed)
- Each step should be actionable: "Create X", "Add Y to Z", "Update W"
- Include relevant file paths
- Order steps logically (dependencies first)

Example Implementation Plan for S/M feature:
\`\`\`markdown
## Implementation Plan

1. Create auth types file at \`src/apis/auth/types.ts\`
2. Create login handler at \`src/apis/auth/handlers/login.ts\`
3. Add API route at \`src/pages/api/process/auth_login.ts\`
4. Create useLogin hook in \`src/client/features/auth/hooks.ts\`
5. Update auth feature exports in \`src/client/features/auth/index.ts\`
6. Run yarn checks to verify
\`\`\`

Example Implementation Plan for L/XL feature:
\`\`\`markdown
## Implementation Plan

### Phase 1: Database Schema
1. Create users collection at \`src/server/database/collections/users.ts\`
2. Add indexes for email field
3. Export types from collection file

### Phase 2: API Endpoints
1. Create auth types at \`src/apis/auth/types.ts\`
2. Create login handler at \`src/apis/auth/handlers/login.ts\`
3. Create register handler at \`src/apis/auth/handlers/register.ts\`
4. Add API routes in \`src/pages/api/process/\`

### Phase 3: UI Components
1. Create LoginForm component at \`src/client/features/auth/LoginForm.tsx\`
2. Create auth store at \`src/client/features/auth/store.ts\`
3. Add route in \`src/client/routes/index.ts\`
\`\`\`

Example for a SMALL feature (S):

\`\`\`markdown
# Technical Design: Add logout button

**Size: S** | **Complexity: Low**

## Overview
Add logout menu item that calls existing auth API and redirects.

## Files to Modify
- \`src/client/components/UserMenu.tsx\`
  - Add logout menu item with onClick handler
- \`src/client/features/auth/hooks.ts\`
  - Add useLogout hook (calls auth/logout API)

## Implementation Plan

1. Create useLogout hook in \`src/client/features/auth/hooks.ts\`
2. Export hook from \`src/client/features/auth/index.ts\`
3. Add logout menu item to UserMenu.tsx with onClick calling useLogout
4. Run yarn checks to verify
\`\`\`

Example for a MEDIUM/LARGE feature:

\`\`\`markdown
# Technical Design: [Feature Title]

**Size: M** | **Complexity: Medium**

## Overview
[Brief technical approach]

## Files to Create
- \`src/apis/feature-name/types.ts\`
  - Purpose: Types
- \`src/apis/feature-name/handlers/create.ts\`
  - Purpose: Create handler
- \`src/client/routes/FeatureName/index.tsx\`
  - Purpose: Main component

## Files to Modify
- \`src/client/routes/index.ts\`
  - Add route

## Data Model (if needed)
\`\`\`typescript
interface FeatureDocument {
  _id: ObjectId;
  // fields...
}
\`\`\`

## API Endpoints (if needed)
- \`feature-name/create\` - POST - Creates new feature item
- \`feature-name/list\` - GET - Lists user's items

## Implementation Notes (if needed)
[Only for complex logic]

## Implementation Plan

1. Create types file at \`src/apis/feature-name/types.ts\`
2. Create handler at \`src/apis/feature-name/handlers/create.ts\`
3. Add API route at \`src/pages/api/process/feature-name_create.ts\`
4. Create main component at \`src/client/routes/FeatureName/index.tsx\`
5. Add route in \`src/client/routes/index.ts\`
6. Run yarn checks to verify
\`\`\`

Example for a LARGE feature (L/XL) with phases:

\`\`\`markdown
# Technical Design: User Authentication System

**Size: L** | **Complexity: High**

## Overview
Implement complete user authentication with login, signup, password reset, and session management.

## Implementation Phases

This feature will be split into 3 PRs:

### Phase 1: Database & Models (S)
- User collection schema
- Session management
- Files: src/server/database/collections/users.ts, src/server/database/collections/sessions.ts

### Phase 2: API Endpoints (M)
- Login, logout, register endpoints
- JWT token handling
- Files: src/apis/auth/*, src/pages/api/process/auth_*.ts

### Phase 3: UI Components (M)
- Login form, register form
- Protected route wrapper
- Files: src/client/features/auth/*

## Files to Create
[List all files across all phases]

## Files to Modify
[List all modifications across all phases]

## Implementation Plan

### Phase 1: Database & Models
1. Create users collection at \`src/server/database/collections/users.ts\`
2. Add User interface with email, passwordHash, createdAt fields
3. Create sessions collection at \`src/server/database/collections/sessions.ts\`
4. Add indexes for email and session token
5. Export types from collection files

### Phase 2: API Endpoints
1. Create auth types at \`src/apis/auth/types.ts\`
2. Create login handler at \`src/apis/auth/handlers/login.ts\`
3. Create register handler at \`src/apis/auth/handlers/register.ts\`
4. Create logout handler at \`src/apis/auth/handlers/logout.ts\`
5. Add API routes in \`src/pages/api/process/\`
6. Test endpoints with curl or API client

### Phase 3: UI Components
1. Create auth store at \`src/client/features/auth/store.ts\`
2. Create LoginForm component at \`src/client/features/auth/LoginForm.tsx\`
3. Create RegisterForm component at \`src/client/features/auth/RegisterForm.tsx\`
4. Create ProtectedRoute wrapper at \`src/client/features/auth/ProtectedRoute.tsx\`
5. Add routes in \`src/client/routes/index.ts\`
6. Wire up forms to auth APIs
\`\`\`

## Output Format Example

**GOOD comment example:**
\`\`\`
Here's the technical design:
1. Size M - single PR with new collection, 2 API endpoints, and list/form UI
2. New \`notes\` MongoDB collection with userId index for per-user queries
3. Two endpoints: \`notes/list\` (GET with pagination) and \`notes/create\` (POST with optimistic update)
4. New NotesRoute page using React Query for data fetching and Zustand for draft state
5. Follows existing patterns from the items feature for consistency
\`\`\`

**BAD comment example (too generic, avoid this):**
\`\`\`
Here's the technical design:
1. Created the design document
2. Listed the files
3. Added implementation plan
\`\`\`

**phases JSON output for L/XL example:**
\`\`\`json
[
  {
    "order": 1,
    "name": "Database & Models",
    "description": "User collection schema and session management",
    "files": [
      "src/server/database/collections/users.ts",
      "src/server/database/collections/sessions.ts",
      "docs/template/mongodb-usage.md",
      "docs/template/project-guidelines/mongodb-usage.md"
    ],
    "estimatedSize": "S"
  },
  {
    "order": 2,
    "name": "API Endpoints",
    "description": "Login, logout, register endpoints with JWT handling",
    "files": [
      "src/apis/auth/types.ts",
      "src/apis/auth/handlers/login.ts",
      "docs/template/api-endpoint-format.md",
      "docs/template/project-guidelines/client-server-communications.md"
    ],
    "estimatedSize": "M"
  },
  {
    "order": 3,
    "name": "UI Components",
    "description": "Login form, register form, protected route wrapper",
    "files": [
      "src/client/features/auth/components/LoginForm.tsx",
      "docs/template/theming.md",
      "docs/template/project-guidelines/react-component-organization.md",
      "docs/template/project-guidelines/shadcn-usage.md"
    ],
    "estimatedSize": "M"
  }
]
\`\`\`

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

Now explore the codebase and create the Technical Design document.`;
}

/**
 * Build prompt for revising technical design based on feedback
 */
export function buildTechDesignRevisionPrompt(
    issue: ProjectItemContent,
    productDesign: string | null,
    existingTechDesign: string,
    feedbackComments: GitHubComment[]
): string {
    const feedbackSection = buildFeedbackSection(feedbackComments);

    const productDesignSection = productDesign
        ? `## Approved Product Design

${productDesign}

`
        : '';

    return `You are revising a Technical Design document based on admin feedback.

${READ_ONLY_MODE_INSTRUCTIONS}

${buildIssueDetailsHeader(issue, { includeDescription: false })}

${productDesignSection}## Existing Technical Design

${existingTechDesign}

## Feedback History

${FEEDBACK_HISTORY_INSTRUCTIONS}

${feedbackSection}

## Your Task

1. Carefully read all feedback comments to understand the full context
2. **Look for the most recent "✅ Addressed Feedback" marker** - this shows where the last revision cycle ended
3. **Address ALL feedback comments that appear AFTER the marker** (there may be multiple comments covering different areas)
4. If no marker exists, this is the first revision - address all feedback comments
5. Research any areas mentioned in the feedback
6. Revise the Technical Design to address all the relevant feedback points
7. Keep the output size proportional to the feature complexity

## Output Format

Provide your response as structured JSON with these fields:
- **design**: COMPLETE revised Technical Design document in markdown format (entire document, not just changes)
- **comment**: High-level summary of what you changed to post as GitHub comment (3-5 bullet points). Use markdown numbered list with each item on a NEW LINE

Do NOT output just the changes in design - output the entire revised document. Keep it concise.

## Output Format Example

**GOOD comment example:**
\`\`\`
Here's what I revised in the technical design:
1. [Feedback: missing pagination] → Added cursor-based pagination to the list endpoint with 20-item default
2. [Feedback: no error handling for duplicate entries] → Added unique index on (userId, name) and 409 conflict response
3. Updated implementation plan to reflect the new pagination and uniqueness requirements
\`\`\`

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

Now revise the Technical Design based on the feedback.`;
}

/**
 * Build prompt for continuing technical design after clarification
 */
export function buildTechDesignClarificationPrompt(
    content: { title: string; number: number; body: string },
    productDesign: string | null,
    issueComments: Array<{ body: string; author: string; createdAt: string }>,
    clarification: { body: string; author: string; createdAt: string }
): string {
    const productDesignSection = productDesign
        ? `## Product Design\n\n${productDesign}\n`
        : '';

    const commentsSection = issueComments.length > 0
        ? `\n## All Issue Comments\n\n${formatCommentsList(issueComments)}\n`
        : '';

    return `You previously asked for clarification while working on the technical design for this feature.

## Issue
**Title:** ${content.title}
**Number:** ${content.number}

**Description:**
${content.body}

${productDesignSection}${commentsSection}
## Your Question
You asked for clarification because you encountered ambiguity. Review the GitHub issue comments above to see your question.

## Admin's Clarification
**From:** ${clarification.author}
**Date:** ${clarification.createdAt}

${clarification.body}

## Task
Continue your technical design work using the admin's clarification as guidance. Complete the technical design document.

If the admin's response is still unclear or raises new ambiguities, you may ask another clarification question using the same format.

**Requirements:**
- List all files to create/modify with specific paths
- Provide clear implementation guidance
- Include data models if database changes are needed
- Specify API endpoints if backend work is needed
- Keep the size proportional to the feature complexity

## Output Format

Provide your response as structured JSON with these fields:
- **design**: Complete Technical Design document in markdown format
- **comment**: High-level implementation plan to post as GitHub comment (3-5 bullet points). Use markdown numbered list with each item on a NEW LINE

## Output Format Example

**GOOD comment example:**
\`\`\`
Here's the technical design (after clarification):
1. Admin confirmed we should use the existing auth middleware - no new auth system needed
2. Size S - just adding a new endpoint and connecting it to the existing UI component
3. New handler at \`src/apis/items/handlers/archive.ts\` with soft-delete pattern
4. Updated implementation plan to 4 steps including the UI toggle
\`\`\`

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

Now complete the Technical Design document using the clarification provided.`;
}
