# Technical Design Agent

## Purpose

The Technical Design Agent translates product requirements into technical implementation specifications. It determines the architecture, file structure, database schema, API design, and implementation approach for features.

**Note:** Bug fix investigations are now handled by the Bug Investigator Agent. When bugs arrive at Tech Design (from Bug Investigation), they are treated like any other item needing technical design, with context provided in the issue comments.

**Key Responsibilities:**
- Generate technical designs for features
- Break large features (L/XL) into multiple implementation phases
- Revise designs based on admin feedback
- Answer admin clarification requests
- Post phase information as structured GitHub comments

## Entry Point

**File:** `src/agents/core-agents/technicalDesignAgent/index.ts`

**Invocation:**
```bash
yarn agent:tech-design                    # Process all pending
yarn agent:tech-design --id <item-id>     # Process specific item
yarn agent:tech-design --dry-run          # Preview without saving
yarn agent:tech-design --stream           # Stream Claude output
```

## Integration in Overall Flow

### Position in Pipeline

```
Issue Created
     ↓
   Inbox
     ↓
Product Design (features)
     or
Bug Investigation (bugs)
     ↓
Technical Design ← YOU ARE HERE
     ↓
Implementation
     ↓
PR Review
     ↓
   Done
```

### Trigger Conditions

The agent processes items that match:
1. **Status:** `"Technical Design"`
2. **Review Status:** Empty (new design) OR `"Request Changes"` (revision) OR `"Clarification Received"`

### Status Transitions

**Input States:**
- Status: `"Technical Design"` + Review Status: `null` → Generate new design
- Status: `"Technical Design"` + Review Status: `"Request Changes"` → Revise design
- Status: `"Technical Design"` + Review Status: `"Clarification Received"` → Continue after clarification

**Output State:**
- Status: `"Technical Design"` (unchanged)
- Review Status: `"Waiting for Review"`
- **Special:** Posts phases comment for L/XL features

**Next Phase (after admin approval):**
- Admin sets Review Status: `"Approved"`
- Auto-advance moves to Status: `"Implementation"`

## How It Works

### Flow A: New Design

```
1. Fetch GitHub Project item
   - Status: "Technical Design"
   - Review Status: empty

2. Load context
   - Issue body (original description + product design)
   - Issue comments (may contain Bug Investigation results)

3. Idempotency check
   - Extract existing tech design from issue body
   - If found → Skip (avoid duplication)
   - If not found → Continue

4. Extract product design
   - Use extractProductDesign() on issue body
   - May be null for internal/technical work

5. Build prompt
   - Use buildTechDesignPrompt()
   - Include: original description, product design, comments
   - For bugs from Bug Investigation, comments include investigation results

6. Run LLM
   - Model: Configured in agentConfig
   - Output format: TECH_DESIGN_OUTPUT_FORMAT (structured JSON)
   - Expected output: { design: string, comment?: string, phases?: ImplementationPhase[] }

7. Extract structured output
   - Primary: Use structuredOutput.design
   - Fallback: Extract markdown from text response
   - Phases: structuredOutput.phases (if L/XL feature)

8. Check for clarification request
   - If LLM needs clarification → Post comment, set status, exit
   - If no clarification needed → Continue

9. Update issue body
   - Preserve original description + product design
   - Add tech design section with markers
   - Format: <!-- TECH_DESIGN_START --> ... <!-- TECH_DESIGN_END -->

10. Post summary comment (if available)
    - Use structuredOutput.comment
    - Add agent prefix: [Technical Design Agent]

11. Save phases to MongoDB and post comment (L/XL features only)
    - Check if phases exist (length >= 2)
    - Save to MongoDB via `savePhasesToDB()` (primary storage)
    - Check idempotency (hasPhaseComment)
    - Format phases using formatPhasesToComment()
    - Post with marker: <!-- AGENT_PHASES_V1 --> (for human readability)

12. Set Review Status
    - Update to "Waiting for Review"

13. Send notification
    - Notify admin via Telegram
    - Include summary if available
```

### Flow B: Address Feedback

```
1. Fetch GitHub Project item
   - Status: "Technical Design"
   - Review Status: "Request Changes"

2. Read existing design
   - Extract tech design from issue body
   - If not found → Error (nothing to revise)

3. Read feedback comments
   - Get all issue comments
   - If no comments → Error (need feedback)

4. Build revision prompt
   - Use buildTechDesignRevisionPrompt()
   - Include: original design, product design, feedback

5. Run LLM and update (same as Flow A, steps 6-13)
```

### Flow C: Continue After Clarification

```
1. Fetch GitHub Project item
   - Status: "Technical Design"
   - Review Status: "Clarification Received"

2. Read clarification
   - Get latest comment (admin's answer)

3. Build clarification prompt
   - Use buildTechDesignClarificationPrompt()
   - Include: original request, product design, all comments

4. Run LLM and update (same as Flow A, steps 6-13)
```

## Multi-Phase Workflow (L/XL Features)

### Phase Generation

The LLM can output implementation phases for large features:

```json
{
    "design": "# Technical Design\n\n[...design content...]",
    "comment": "Summary for admin",
    "phases": [
        {
            "order": 1,
            "name": "Database Schema",
            "description": "Set up user and session collections",
            "files": ["src/server/database/collections/users.ts"],
            "estimatedSize": "S"
        },
        {
            "order": 2,
            "name": "API Endpoints",
            "description": "Implement authentication endpoints",
            "files": ["src/apis/auth/index.ts"],
            "estimatedSize": "M"
        }
    ]
}
```

### Phase Comment Format

When `phases.length >= 2`, agent posts:

```markdown
<!-- AGENT_PHASES_V1 -->
## Implementation Phases

This feature will be implemented in 3 sequential PRs:

### Phase 1: Database Schema (S)

Set up user and session collections

**Files to modify:**
- `src/server/database/collections/users.ts`
- `src/server/database/collections/sessions.ts`

### Phase 2: API Endpoints (M)

Implement authentication endpoints

**Files to modify:**
- `src/apis/auth/index.ts`
- `src/pages/api/process/auth_login.ts`

### Phase 3: UI Components (M)

Build login form and protected routes

**Files to modify:**
- `src/client/features/auth/LoginForm.tsx`
- `src/client/features/auth/ProtectedRoute.tsx`

---
*Phase tracking managed by Implementation Agent*
```

### Idempotency for Phases

```typescript
if (structuredOutput?.phases && structuredOutput.phases.length >= 2) {
    // Check if phases comment already exists (idempotency)
    if (!hasPhaseComment(issueComments)) {
        const phasesComment = formatPhasesToComment(structuredOutput.phases);
        await adapter.addIssueComment(issueNumber, phasesComment);
    } else {
        console.log('Phases comment already exists, skipping');
    }
}
```

## GitHub Issue Interaction

### Reading from Issue

**Issue Body Structure:**
```markdown
[Original user request]

<!-- PRODUCT_DESIGN_START -->
# Product Design
[Product design content...]
<!-- PRODUCT_DESIGN_END -->

<!-- TECH_DESIGN_START -->
<!-- Generated: 2024-01-24T10:00:00Z -->
<!-- Iteration: 1 -->

# Technical Design
[Technical design content...]

<!-- TECH_DESIGN_END -->
```

**What we read:**
- `extractOriginalDescription()` - Gets text before design markers
- `extractProductDesign()` - Extracts product design (for context)
- `extractTechDesign()` - Extracts existing tech design (for revisions)
- `adapter.getIssueComments()` - Gets all comments (including Bug Investigation results)

**Comments Read:**
- All issue comments (for feedback and context)
- Bug Investigation comments (provide root cause and selected fix approach)
- Phases comment (checked for idempotency)

### Writing to Issue

**Update Issue Body:**
```typescript
const originalDescription = extractOriginalDescription(content.body);
const productDesign = extractProductDesign(content.body);  // Preserve
const newBody = buildUpdatedIssueBody(
    originalDescription,  // Original request
    productDesign,        // Preserve product design
    design                // NEW tech design
);
await adapter.updateIssueBody(issueNumber, newBody);
```

**Post Summary Comment:**
```typescript
const prefixedComment = addAgentPrefix('tech-design', comment);
await adapter.addIssueComment(issueNumber, prefixedComment);
```

**Post Phases Comment (L/XL only):**
```typescript
if (structuredOutput?.phases && structuredOutput.phases.length >= 2) {
    if (!hasPhaseComment(issueComments)) {
        const phasesComment = formatPhasesToComment(structuredOutput.phases);
        await adapter.addIssueComment(issueNumber, phasesComment);
    }
}
```

## LLM Response Format

### Structured Output Schema

```typescript
{
    type: 'json_schema',
    schema: {
        type: 'object',
        properties: {
            design: {
                type: 'string',
                description: 'Complete technical design document in markdown'
            },
            comment: {
                type: 'string',
                description: 'Optional summary comment to post on issue'
            },
            phases: {
                type: 'array',
                description: 'Implementation phases for L/XL features (optional, 2-5 phases)',
                items: {
                    type: 'object',
                    properties: {
                        order: { type: 'number' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                        files: {
                            type: 'array',
                            items: { type: 'string' }
                        },
                        estimatedSize: {
                            type: 'string',
                            enum: ['S', 'M']
                        }
                    },
                    required: ['order', 'name', 'description', 'files', 'estimatedSize']
                }
            }
        },
        required: ['design']
    }
}
```

### Expected Response (Single Phase)

```json
{
    "design": "# Technical Design\n\n## Architecture\n[...detailed design...]",
    "comment": "I've created a technical design that uses [...summary...]"
}
```

### Expected Response (Multi-Phase)

```json
{
    "design": "# Technical Design\n\n## Architecture\n[...overall design...]",
    "comment": "This is a large feature split into 3 phases: [...summary...]",
    "phases": [
        {
            "order": 1,
            "name": "Database Schema",
            "description": "Set up collections",
            "files": ["src/server/database/collections/users.ts"],
            "estimatedSize": "S"
        },
        {
            "order": 2,
            "name": "API Layer",
            "description": "Build endpoints",
            "files": ["src/apis/auth/index.ts"],
            "estimatedSize": "M"
        },
        {
            "order": 3,
            "name": "UI Layer",
            "description": "Create components",
            "files": ["src/client/features/auth/LoginForm.tsx"],
            "estimatedSize": "M"
        }
    ]
}
```

### Fallback Handling

If structured output fails:
1. Extract markdown from raw text using `extractMarkdown()`
2. Use extracted content as design
3. No summary comment (comment will be undefined)
4. No phases (phases will be undefined)

## Status Field Updates

### Review Status Changes

| From | To | Trigger |
|------|----|----|
| `null` (empty) | `"Waiting for Review"` | New design generated |
| `"Request Changes"` | `"Waiting for Review"` | Revised design generated |
| `"Clarification Received"` | `"Waiting for Review"` | Clarification addressed |
| Any | `"Waiting for Clarification"` | Agent needs clarification |

### GitHub Project Fields Updated

```typescript
// Set Review Status
await adapter.updateItemReviewStatus(item.id, REVIEW_STATUSES.waitingForReview);

// Status field is NOT changed by this agent (stays "Technical Design")

// Implementation Phase field NOT set here (set by Implementation Agent)
```

## Connection to Other Agents

### Upstream (Before)

**Product Design Agent:**
- Generates product design
- Stored in issue body
- This agent reads it for context

**Bug Investigator Agent:**
- For bugs: Investigates root cause
- Posts investigation results as comment
- Admin selects fix approach
- When routed to Tech Design, investigation context is available in comments

### Downstream (After)

**Implementation Agent:**
- Reads tech design from issue body
- Reads phases from comment (if multi-phase)
- Uses design to implement the feature
- Triggered when: Status = "Implementation"

**PR Review Agent:**
- Doesn't directly use tech design
- Reviews based on code changes
- For multi-phase: Knows which phase it's reviewing

### Parallel/Related

**Auto-Advance Agent:**
- Monitors Review Status changes
- When admin sets Review Status to "Approved" → Moves to "Implementation"

## Edge Cases

### 1. Design Already Exists

**Scenario:** Running agent on issue that already has tech design

**Handling:**
```typescript
const existingTechDesign = extractTechDesign(content.body);
if (existingTechDesign) {
    console.log('⚠️  Technical design already exists - skipping to avoid duplication');
    return { success: false, error: 'Technical design already exists (idempotency check)' };
}
```

**Resolution:** Use feedback mode or manually remove existing design

### 2. Phase Comment Already Exists

**Scenario:** Re-running agent after phases already posted

**Handling:**
```typescript
if (!hasPhaseComment(issueComments)) {
    // Post phases comment
} else {
    console.log('Phases comment already exists, skipping');
}
```

**Impact:** Skips posting duplicate phase comment (idempotent)

### 3. Feature Without Product Design

**Scenario:** Internal/technical work that skipped product design

**Handling:**
```typescript
const productDesign = extractProductDesign(content.body);
// May be null - that's okay
prompt = buildTechDesignPrompt(content, productDesign, issueComments);
```

**Impact:** Agent works fine, just has less context

### 4. Single-Phase L Feature

**Scenario:** LLM returns only 1 phase for a Large feature

**Handling:**
```typescript
if (structuredOutput?.phases && structuredOutput.phases.length >= 2) {
    // Post phases comment
}
// If length === 1, doesn't post phases comment
// Feature treated as single-phase
```

**Impact:** Feature implemented in one PR (no multi-phase workflow)

### 5. Invalid Phase Data

**Scenario:** LLM returns malformed phases (missing fields, wrong types)

**Handling:**
- TypeScript validation during structured output parsing
- If validation fails → Falls back to text extraction
- Phases would be undefined
- Feature treated as single-phase

### 6. No Feedback Comments

**Scenario:** Review Status = "Request Changes" but no comments

**Handling:**
```typescript
if (issueComments.length === 0) {
    return { success: false, error: 'No feedback comments found' };
}
```

**Resolution:** Admin must post feedback comment first

## Implementation Details

### Key Dependencies

```typescript
// Project management
import { getProjectManagementAdapter } from '../../shared';

// Prompts
import {
    buildTechDesignPrompt,
    buildTechDesignRevisionPrompt,
    buildTechDesignClarificationPrompt,
} from '../../shared';

// Parsing
import {
    extractOriginalDescription,
    extractProductDesign,
    extractTechDesign,
    buildUpdatedIssueBody
} from '../../shared';

// Phases (for multi-PR workflow)
import {
    formatPhasesToComment,
    hasPhaseComment
} from '../../lib/phases';

// Utils
import { getIssueType } from '../../shared';
```

### Prompts Location

**File:** `src/agents/shared/prompts/`

**Functions:**
- `buildTechDesignPrompt()` - Feature tech design (standard flow)
- `buildTechDesignRevisionPrompt()` - Feature revision based on feedback
- `buildTechDesignClarificationPrompt()` - Continue after admin clarification

### Phase Utilities Location

**File:** `src/agents/lib/phases.ts`

**Functions:**
- `formatPhasesToComment(phases)` - Converts ImplementationPhase[] to markdown
- `parsePhasesFromComment(comments)` - Extracts phases from comment (fallback for backward compat)
- `hasPhaseComment(comments)` - Checks if phases already posted
- `getPhaseCommentMarker()` - Returns `<!-- AGENT_PHASES_V1 -->`

**File:** `src/agents/lib/workflow-db.ts` (DB helpers - primary storage)

**Functions:**
- `savePhasesToDB(issueNumber, phases)` - Save phases to MongoDB artifacts
- `getPhasesFromDB(issueNumber)` - Read phases from MongoDB (primary source)

## Configuration

**Agent Config:**
```typescript
// src/agents/agents.config.ts
export const agentConfig = {
    claude: {
        timeoutSeconds: 600,  // 10 minutes max
    }
};
```

**Timeout Override:**
```bash
yarn agent:tech-design --timeout 900  # 15 minutes
```

## CLI Options

```bash
--id <itemId>        # Process specific item by ID
--limit <number>     # Limit number of items to process (batch mode)
--timeout <seconds>  # Override default timeout
--dry-run            # Preview without saving (no GitHub updates)
--stream             # Stream Claude output in real-time
--verbose            # Show additional debug output
```

## Debugging

**Dry Run Mode:**
```bash
yarn agent:tech-design --dry-run --stream --verbose
```

Shows:
- What would be updated (issue body, review status)
- What comments would be posted (summary + phases)
- Full LLM response (if --stream)
- Detailed execution logs (if --verbose)

**Check Phase Comment:**
```bash
# After running agent, check issue comments for:
<!-- AGENT_PHASES_V1 -->
```

**Common Issues:**

1. **"Technical design already exists"**
   - Cause: Idempotency check triggered
   - Fix: Use feedback mode or manually remove existing design

2. **"No feedback comments found"**
   - Cause: Review Status = "Request Changes" but no comments
   - Fix: Admin must post feedback first

3. **Phases not posted**
   - Cause: LLM returned < 2 phases, or phases comment already exists
   - Check: Look for `<!-- AGENT_PHASES_V1 -->` in issue comments

## Testing

**Manual Test (Feature):**
```bash
# 1. Create test issue with product design
# 2. Add to GitHub Project with status "Technical Design"
# 3. Run agent
yarn agent:tech-design --id <project-item-id> --dry-run --stream

# 4. Verify output
# 5. Run without --dry-run
yarn agent:tech-design --id <project-item-id>

# 6. Check:
#    - Issue body has tech design
#    - Review Status = "Waiting for Review"
#    - Phases comment posted (if L/XL)
```

**Manual Test (Multi-Phase):**
```bash
# 1. Create L/XL feature
# 2. Run agent
yarn agent:tech-design --id <project-item-id>

# 3. Check issue comments for phases:
# Look for: <!-- AGENT_PHASES_V1 -->

# 4. Verify phases format matches spec
```

## Related Documentation

- **Overall workflow:** `docs/template/github-agents-workflow/overview.md`
- **Bug Investigation workflow:** `docs/template/github-agents-workflow/bug-investigation.md`
- **Multi-PR workflow:** `docs/template/github-agents-workflow/multi-phase-features.md`
- **Setup guide:** `docs/template/github-agents-workflow/setup-guide.md`
- **Prompts:** `src/agents/shared/prompts/`
- **Output schemas:** `src/agents/shared/output-schemas.ts`
- **Phase utilities:** `src/agents/lib/phases.ts`
