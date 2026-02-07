# Implementation Agent

## Purpose

The Implementation Agent writes code to implement features and fix bugs based on technical designs. It creates branches, writes code, runs tests, creates pull requests, and manages multi-phase implementations for large features.

**Key Responsibilities:**
- Implement features based on tech design
- Fix bugs based on tech design and diagnostics
- Create feature branches with proper naming
- Write code following project guidelines
- Run validation checks (TypeScript, ESLint)
- Create pull requests with proper formatting
- Manage multi-phase implementations (L/XL features)
- Address PR feedback and revise code
- Trigger automated PR reviews

## Entry Point

**File:** `src/agents/core-agents/implementAgent/index.ts`

**Invocation:**
```bash
yarn agent:implement                    # Process all pending
yarn agent:implement --id <item-id>     # Process specific item
yarn agent:implement --dry-run          # Preview without saving
yarn agent:implement --stream           # Stream Claude output
yarn agent:implement --skip-push        # Don't push to remote (testing)
yarn agent:implement --skip-pull        # Don't pull latest (testing)
```

## Integration in Overall Flow

### Position in Pipeline

```
Issue Created
     ↓
   Inbox
     ↓
Product Design (features only)
     ↓
Technical Design
     ↓
Implementation ← YOU ARE HERE
     ↓
PR Review
     ↓
   Done
```

### Trigger Conditions

The agent processes items that match:
1. **Status:** `"Implementation"`
2. **Review Status:** Empty (new implementation) OR `"Request Changes"` (address PR feedback)
3. **Has linked issue** with tech design

### Status Transitions

**Input States:**
- Status: `"Implementation"` + Review Status: `null` → New implementation
- Status: `"Implementation"` + Review Status: `"Request Changes"` → Address PR feedback

**Output State:**
- Status: `"PR Review"`
- Review Status: `"Waiting for Review"`
- **Multi-phase:** Sets Implementation Phase field: `"1/3"`, `"2/3"`, etc.

**Next Phase (after PR merge):**
- Webhook triggers on PR merge
- If multi-phase:
  - Increments phase: `"2/3"` → `"3/3"`
  - Returns to Status: `"Implementation"` (for next phase)
  - When final phase merges → Status: `"Done"`, clears phase field
- If single-phase:
  - Status: `"Done"` immediately

## Multi-Phase Workflow

### Phase Detection

```typescript
// Check for existing phase tracking
const existingPhase = await adapter.getImplementationPhase(item.id);
const parsed = parsePhaseString(existingPhase);  // "2/3" → { current: 2, total: 3 }

if (parsed) {
    // Multi-phase feature in progress
    currentPhase = parsed.current;
    totalPhases = parsed.total;
} else if (mode === 'new') {
    // Check if tech design has phases
    const parsedPhases = parsePhasesFromComment(issueComments) ||
                         extractPhasesFromTechDesign(techDesign);

    if (parsedPhases && parsedPhases.length >= 2) {
        // Start multi-phase implementation
        currentPhase = 1;
        totalPhases = parsedPhases.length;
        await adapter.setImplementationPhase(item.id, "1/${totalPhases}");
    }
}
```

### Phase Information Sources

**Primary Source (MongoDB):**
```typescript
// Read phases from MongoDB artifacts
const phases = await getPhasesFromDB(issueNumber);
```

**Fallback Source 1 (GitHub Comment):**
```typescript
// Read phases from GitHub issue comment
const phases = parsePhasesFromComment(issueComments);
```

Comment format: `<!-- AGENT_PHASES_V1 -->`

**Fallback Source 2 (Markdown):**
```typescript
// Parse phases from tech design markdown
const phases = extractPhasesFromTechDesign(techDesign);
```

**Phase Data:**
```typescript
interface ImplementationPhase {
    order: number;           // 1, 2, 3, ...
    name: string;           // "Database Schema"
    description: string;    // "Set up user and session collections"
    files: string[];        // ["src/server/database/collections/users.ts"]
    estimatedSize: 'S' | 'M';  // Expected PR size
}
```

### Branch Naming (Phase-Aware)

**Single-phase:**
```
feature/issue-123-add-authentication
fix/issue-456-login-crash
```

**Multi-phase:**
```
feature/issue-123-phase-1-add-authentication
feature/issue-123-phase-2-add-authentication
feature/issue-123-phase-3-add-authentication
```

### PR Title (Phase-Aware)

**Single-phase:**
```
feat: add user authentication
fix: resolve login crash on invalid credentials
```

**Multi-phase:**
```
feat: add user authentication (Phase 1/3)
feat: add user authentication (Phase 2/3)
feat: add user authentication (Phase 3/3)
```

### Prompt Context (Phase-Aware)

When implementing a specific phase:

```markdown
## ⚠️ MULTI-PHASE IMPLEMENTATION

This is a large feature split into multiple phases.

**You are implementing Phase 2 of 3: API Endpoints**

Description: Implement login, logout, and register endpoints

Expected files to modify:
- src/apis/auth/index.ts
- src/pages/api/process/auth_login.ts
- src/pages/api/process/auth_logout.ts

**CRITICAL CONSTRAINTS:**
1. ONLY implement Phase 2 functionality
2. DO NOT implement Phase 3 features (UI components)
3. Ensure this phase is independently testable and mergeable
4. Previous phases are already merged (Phase 1 complete)

[...rest of prompt...]
```

## How It Works

### Flow A: New Implementation (Single-Phase)

```
1. Fetch GitHub Project item
   - Status: "Implementation"
   - Review Status: empty

2. Load context
   - Issue body (original + designs)
   - Tech design (required)
   - Product design (may be null for bugs/internal work)
   - Bug diagnostics (if bug)
   - Issue comments (for context)

3. Check for multi-phase
   - Read Implementation Phase field
   - If not set, check for phases in comments/tech design
   - If no phases → Single-phase implementation
   - If phases → Multi-phase (see Flow B)

4. Generate branch name
   - Format: {prefix}/issue-{N}-{slug}
   - Prefix: "feature" or "fix" (based on issue type)
   - Slug: Sanitized issue title (40 chars max)

5. Check if branch exists
   - If exists → Use it (idempotency)
   - If not → Will create new branch

6. Build prompt
   - Use buildImplementationPrompt() for features
   - Use buildBugImplementationPrompt() for bugs
   - Include: tech design, product design, branch name, comments

7. Run LLM (with allowed tools)
   - Tools: Read, Glob, Grep, Bash, Write, Edit
   - Bash allowed: git, yarn, npm, build/test commands
   - Output format: IMPLEMENTATION_OUTPUT_FORMAT
   - Expected: { prTitle: string, prBody: string, filesModified: string[] }

8. Validate changes
   - Run yarn checks (TypeScript + ESLint)
   - If fails → Report error, don't create PR
   - If passes → Continue

9. Create Pull Request
   - Title: From LLM output
   - Body: From LLM output (includes "Closes #123")
   - Base: main/master
   - Head: feature branch

10. Post @claude review comment
    - Triggers Claude Code GitHub App review
    - Automatic code review

11. Update GitHub Project
    - Status → "PR Review"
    - Review Status → "Waiting for Review"

12. Send notification
    - Notify admin via Telegram
    - Include PR link
```

### Flow B: New Implementation (Multi-Phase)

```
1-2. Same as Flow A

3. Detect multi-phase
   - Read phases from comment: parsePhasesFromComment()
   - Fallback to markdown: extractPhasesFromTechDesign()
   - Found 3 phases total

4. Initialize phase tracking
   - currentPhase = 1
   - totalPhases = 3
   - Set GitHub field: "1/3"

5. Get current phase details
   - phases.find(p => p.order === 1)
   - Extract: name, description, files, estimatedSize

6. Generate phase-specific branch name
   - Format: {prefix}/issue-{N}-phase-{P}-{slug}
   - Example: "feature/issue-123-phase-1-authentication"

7. Build phase-specific prompt
   - Add phase context to prompt
   - Include: phase name, description, expected files
   - Add constraints: "ONLY implement Phase 1"

8-12. Same as Flow A (LLM run, validate, PR, update, notify)
```

### Flow C: Address PR Feedback

```
1. Fetch GitHub Project item
   - Status: "Implementation" (returned from PR Review after rejection)
   - Review Status: "Request Changes"
   - Has existing PR

2. Find the OPEN PR for this issue (CRITICAL FOR MULTI-PHASE!)
   - Use findOpenPRForIssue(issueNumber)
   - Search open PRs, find one referencing this issue
   - Returns BOTH: prNumber AND branchName
   - If not found → Error (no open PR to fix)

   WHY NOT regenerate branch name?
   - Branch name = f(title, phase) - could change
   - PR itself KNOWS its actual branch name
   - Getting from PR = 100% reliable

3. Checkout existing branch
   - Use branch name FROM the PR (not regenerated)
   - Pull latest changes

4. Load PR context
   - Get PR conversation comments
   - Get PR review comments (inline code reviews)
   - Get tech design, product design

5. Check for multi-phase
   - If phase field exists → Get phase details
   - Include in prompt context

6. Build revision prompt
   - Use buildPRRevisionPrompt()
   - Include: original design, PR comments, review feedback
   - Include phase context if multi-phase

7. Run LLM (same tools as Flow A)
   - LLM reads PR feedback
   - Makes necessary changes
   - Commits to same branch

8. Validate changes
   - Run yarn checks
   - If fails → Report error
   - If passes → Continue

9. Push changes
   - Push to same branch
   - PR automatically updates

10. Update Review Status
    - Review Status → "Waiting for Review"
    - Triggers re-review

11. Send notification
    - Notify admin: "Addressed feedback on PR #123"
```

## GitHub Issue Interaction

### Reading from Issue

**Issue Body:**
```markdown
[Original description]

<!-- PRODUCT_DESIGN_START -->
[Product design...]
<!-- PRODUCT_DESIGN_END -->

<!-- TECH_DESIGN_START -->
[Technical design...]  ← REQUIRED for implementation
<!-- TECH_DESIGN_END -->
```

**Issue Comments:**
1. **Phase comment** (if L/XL feature):
   ```markdown
   <!-- AGENT_PHASES_V1 -->
   ## Implementation Phases
   [Phase details...]
   ```

2. **PR link comments**:
   ```
   Created PR #123
   PR: #123
   ```

3. **Admin feedback** (if addressing feedback)

**What we read:**
- `extractTechDesign()` - Tech design (required)
- `extractProductDesign()` - Product design (optional)
- `parsePhasesFromComment()` - Phases from comment (multi-phase)
- `extractPhasesFromTechDesign()` - Phases from markdown (fallback)
- `adapter.getIssueComments()` - All comments
- `getBugDiagnostics()` - Bug diagnostics (if bug)

### Writing to Issue

**Post PR Link Comment:**
```typescript
await adapter.addIssueComment(
    issueNumber,
    `Created PR #${prNumber}\n${prUrl}`
);
```

**Issue Body:**
- NOT modified by this agent
- Designs remain unchanged

## PR Creation

### PR Title Format

**Convention:**
```
{type}: {description} (Phase {X}/{Y})
                       └─ Only for multi-phase
```

**Type:**
- `feat:` - New feature
- `fix:` - Bug fix

**Examples:**
```
feat: add user authentication
fix: resolve login crash on invalid credentials
feat: add user authentication (Phase 1/3)
feat: add user authentication (Phase 2/3)
```

### PR Body Structure

**Squash-merge ready format:**

```markdown
Implements the feature described in issue #123.

Implementation follows the technical design specifications.
User-facing changes align with product design requirements.

Closes #123

---

**Files changed:**
- src/apis/auth/index.ts
- src/pages/api/process/auth_login.ts

**Multi-phase:** Phase 2 of 3 - API Endpoints
```

**Key points:**
- Above `---`: Included in squash commit message
- Below `---`: PR metadata only
- `Closes #123`: Links PR to issue (auto-closes on merge)
- Multi-phase PRs DO NOT close issue (except final phase)

## LLM Response Format

### Structured Output Schema

```typescript
{
    type: 'json_schema',
    schema: {
        type: 'object',
        properties: {
            prTitle: {
                type: 'string',
                description: 'PR title following conventional commits'
            },
            prBody: {
                type: 'string',
                description: 'PR description (markdown)'
            },
            filesModified: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of files created/modified'
            }
        },
        required: ['prTitle', 'prBody', 'filesModified']
    }
}
```

### Expected Response

```json
{
    "prTitle": "feat: add user authentication (Phase 2/3)",
    "prBody": "Implements authentication API endpoints...\n\nCloses #123",
    "filesModified": [
        "src/apis/auth/index.ts",
        "src/pages/api/process/auth_login.ts"
    ]
}
```

### Allowed Tools

**Read-only:**
- `Read` - Read files
- `Glob` - Find files by pattern
- `Grep` - Search file contents

**Write:**
- `Write` - Create new files
- `Edit` - Modify existing files (preferred over Write)

**Execute:**
- `Bash` - Run commands (restricted)

**Allowed Bash Commands:**
- `git` - All git operations
- `yarn` - Install dependencies, run scripts
- `npm` - Package management
- Build/test commands (defined in package.json)

**Restricted Bash Commands:**
- No destructive operations without user approval
- No network requests (except git/yarn/npm)
- No system modifications

## Status Field Updates

### Status Changes

| From | To | Trigger |
|------|----|----|
| `"Implementation"` | `"PR Review"` | PR created successfully |

### Review Status Changes

| From | To | Trigger |
|------|----|----|
| `null` | `"Waiting for Review"` | New PR created |
| `"Request Changes"` | `"Waiting for Review"` | Addressed feedback, pushed changes |

### Implementation Phase Changes (Multi-Phase Only)

| From | To | Trigger |
|------|----|----|
| `null` | `"1/3"` | First phase started |
| `"1/3"` | `"2/3"` | Phase 1 PR merged (via webhook) |
| `"2/3"` | `"3/3"` | Phase 2 PR merged |
| `"3/3"` | `null` | Phase 3 (final) PR merged |

**Set by this agent:**
```typescript
if (!options.dryRun && adapter.hasImplementationPhaseField()) {
    await adapter.setImplementationPhase(item.id, `${currentPhase}/${totalPhases}`);
}
```

**Updated by webhook:**
```typescript
// src/pages/api/webhooks/github-pr-merged.ts
// Increments phase counter on PR merge
```

## Connection to Other Agents

### Upstream (Before)

**Technical Design Agent:**
- Generates tech design
- Posts phase comment (if L/XL)
- This agent reads both

**Product Design Agent:**
- Generates product design (features only)
- This agent reads it for context

### Downstream (After)

**PR Review Agent:**
- Reviews the created PR
- Phase-aware: Knows which phase it's reviewing
- Validates PR only implements correct phase
- Triggered by: Status = "PR Review" + Review Status = "Waiting for Review"

### Triggers

**Automated PR Review:**
```typescript
// This agent posts:
await adapter.addPRComment(prNumber, '@claude please review this PR');

// Triggers Claude Code GitHub App (external service)
// Provides automated code review
```

### Webhooks

**PR Merge Webhook:**
```
PR merged → Webhook fires → Updates Implementation Phase
```

**For multi-phase:**
- Phase 1 merged → Phase field: "1/3" → "2/3", Status → "Implementation"
- Phase 2 merged → Phase field: "2/3" → "3/3", Status → "Implementation"
- Phase 3 merged → Phase field: cleared, Status → "Done"

**For single-phase:**
- PR merged → Status → "Done"

## Edge Cases

### 1. Branch Already Exists

**Scenario:** Running agent when feature branch exists

**Handling:**
```typescript
const branchExistsRemotely = await adapter.branchExists(branchName);
if (branchExistsRemotely) {
    console.log(`Branch ${branchName} already exists, will use it`);
}
```

**Impact:** Uses existing branch (idempotent), creates new commits

### 2. Uncommitted Local Changes

**Scenario:** Local git workspace has uncommitted changes

**Handling:**
```typescript
const hasChanges = await hasUncommittedChanges();
if (hasChanges) {
    throw new Error('Uncommitted changes exist. Commit or stash them first.');
}
```

**Resolution:** User must commit or stash changes manually

### 3. Validation Fails (yarn checks)

**Scenario:** Code has TypeScript or ESLint errors

**Handling:**
```typescript
const checksResult = execSync('yarn checks');
if (checksResult.failed) {
    console.error('Validation failed - not creating PR');
    // Notification sent to admin
    return { success: false, error: 'Validation failed' };
}
```

**Impact:** No PR created, changes remain on branch, admin notified

### 4. No Tech Design

**Scenario:** Issue has no tech design section

**Handling:**
```typescript
const techDesign = extractTechDesign(content.body);
if (!techDesign) {
    console.log('Note: No technical design found');
}
// Continues anyway (may implement from product design or description only)
```

**Impact:** Agent tries to implement anyway, may fail or ask for clarification

### 5. PR Handling in Different Modes

**Scenario A: New Implementation (mode === 'new')**

When status is "Ready for dev" with empty Review Status:
- **Always creates a new PR** - no idempotency check
- Why? In multi-phase workflows, old merged PRs from previous phases would be incorrectly detected as "existing" PRs
- If a PR already exists for the same branch, git push will update it

**Scenario B: Addressing Feedback (mode === 'feedback')**

When status is "Implementation" (returned from PR Review) with Review Status = "Request Changes":
- **Must find the OPEN PR** using `findOpenPRForIssue()`
- Gets both PR number AND branch name from the open PR
- If no open PR found → Skip with warning (no PR to fix)

**Why get branch from PR?**
- Branch name is deterministic but depends on title + phase
- If title changed or phase number doesn't match expectations, regeneration fails
- The PR itself knows its actual branch name - use that!

**Impact:**
- New mode: Always creates new PR, no risk of reusing merged PRs
- Feedback mode: Uses existing open PR with correct branch name

### 6. Phase Out of Bounds

**Scenario:** Phase field says "4/3" (invalid state)

**Handling:**
```typescript
const parsed = parsePhaseString("4/3");
if (parsed && parsed.current > parsed.total) {
    // Invalid state
    console.error('Invalid phase state');
}
```

**Resolution:** Manual intervention needed, likely data corruption

### 7. Phases Changed During Implementation

**Scenario:** Admin updates phase comment while implementing

**Handling:**
- Agent reads phases at start
- Uses snapshot throughout execution
- Next run will pick up changes

**Impact:** Current run uses old phase data, next run uses new

### 8. Bug Without Diagnostics

**Scenario:** Bug implementation but no diagnostics

**Handling:**
```typescript
if (!diagnostics && !options.dryRun) {
    await notifyAdmin(
        `⚠️ Warning: Bug diagnostics missing\n` +
        `The implementation may be incomplete without this context.`
    );
}
// Continues anyway
```

**Impact:** Implementation may miss context, likely needs revision

## Implementation Details

### Key Dependencies

```typescript
// Project management
import { getProjectManagementAdapter } from '../../shared';

// Prompts
import {
    buildImplementationPrompt,
    buildBugImplementationPrompt,
    buildPRRevisionPrompt
} from '../../shared';

// Parsing
import {
    extractTechDesign,
    extractProductDesign,
    parsePhaseString,
    extractPhasesFromTechDesign
} from '../../lib/parsing';

// Phases (DB-first with comment fallback)
import { getPhasesFromDB } from '../../lib/workflow-db';
import { parsePhasesFromComment } from '../../lib/phases';

// Utils
import {
    getIssueType,
    getBugDiagnostics
} from '../../shared';
```

### Git Operations

**Branch Creation:**
```bash
git checkout -b feature/issue-123-my-feature
```

**Commit Format:**
```bash
git commit -m "feat: implement authentication API

- Add login endpoint
- Add register endpoint
- Add session management

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Push:**
```bash
git push -u origin feature/issue-123-my-feature
```

### Validation Commands

**Run before creating PR:**
```bash
yarn checks  # Runs: yarn ts && yarn lint
```

**TypeScript:**
```bash
tsc --noEmit
```

**ESLint:**
```bash
next lint
```

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
yarn agent:implement --timeout 1200  # 20 minutes
```

## CLI Options

```bash
--id <itemId>        # Process specific item by ID
--limit <number>     # Limit number of items to process
--timeout <seconds>  # Override default timeout
--dry-run            # Preview without saving (no GitHub updates)
--stream             # Stream Claude output in real-time
--verbose            # Show additional debug output
--skip-push          # Don't push to remote (for testing)
--skip-pull          # Don't pull latest from master (for testing)
```

## Debugging

**Dry Run Mode:**
```bash
yarn agent:implement --dry-run --stream --verbose
```

Shows:
- What branch would be created
- What files would be modified
- What PR would be created (title, body)
- Status/phase updates that would happen
- Full LLM response (if --stream)

**Skip Push (Local Testing):**
```bash
yarn agent:implement --skip-push --skip-pull
```

Useful for:
- Testing prompt changes
- Testing phase logic
- Inspecting generated code locally

**Common Issues:**

1. **"Uncommitted changes exist"**
   - Fix: `git stash` or commit changes

2. **"Validation failed"**
   - Check `yarn checks` output
   - Fix TypeScript/ESLint errors manually
   - Re-run agent

3. **"No tech design found"**
   - Ensure tech design agent ran first
   - Check issue body has `<!-- TECH_DESIGN_START -->`

4. **"Branch already exists"**
   - Agent will use existing branch
   - Delete branch if you want fresh start: `git branch -D feature/...`

5. **Phase mismatch**
   - Check Implementation Phase field in GitHub Project
   - Check phase comment in issue
   - Manually fix if corrupted

## Testing

**Manual Test (Single-Phase):**
```bash
# 1. Create issue with tech design
# 2. Add to GitHub Project, status "Implementation"
# 3. Run agent
yarn agent:implement --id <item-id> --dry-run --stream

# 4. Verify:
#    - Branch name correct
#    - Files would be created/modified
#    - PR title/body look good

# 5. Run for real
yarn agent:implement --id <item-id>

# 6. Check:
#    - Branch created
#    - Files committed
#    - PR created
#    - Status → "PR Review"
#    - Review Status → "Waiting for Review"
```

**Manual Test (Multi-Phase):**
```bash
# 1. Create L/XL issue with tech design + phases comment
# 2. Add to GitHub Project, status "Implementation"
# 3. Run agent (should start Phase 1)
yarn agent:implement --id <item-id>

# 4. Check:
#    - Implementation Phase field: "1/3"
#    - Branch: feature/issue-123-phase-1-...
#    - PR title includes "(Phase 1/3)"
#    - PR body mentions phase

# 5. Merge PR #1
# 6. Webhook updates Phase: "1/3" → "2/3", Status → "Implementation"
# 7. Run agent again (should start Phase 2)
yarn agent:implement --id <item-id>

# 8. Repeat for all phases
```

**Manual Test (Address Feedback):**
```bash
# 1. Have existing PR with feedback
# 2. Admin sets Review Status: "Request Changes"
# 3. Status → "Implementation"
# 4. Run agent
yarn agent:implement --id <item-id>

# 5. Check:
#    - Checkout existing branch
#    - Read PR comments
#    - Make changes
#    - Push to same branch
#    - Review Status → "Waiting for Review"
```

## Related Documentation

- **Overall workflow:** `docs/github-projects-integration.md`
- **Multi-PR workflow:** `docs/github-projects-integration.md#multi-pr-workflow-lxl-features`
- **Phase architecture:** `docs/github-projects-integration.md#phase-storage--retrieval`
- **PR format:** `docs/github-projects-integration.md#pull-request-format-squash-merge-ready`
- **Webhook handling:** `src/pages/api/webhooks/github-pr-merged.ts`
- **Phase utilities:** `src/agents/lib/phases.ts`
