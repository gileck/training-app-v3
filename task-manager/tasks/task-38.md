---
number: 38
title: "Implement AWS S3 Issue Log System for Agent Workflow"
priority: High
complexity: Medium
size: M
status: TODO
dateAdded: 2026-02-02
---

# Task 38: Implement AWS S3 Issue Log System for Agent Workflow

**Summary:** Use AWS S3 as temporary log storage during active workflows, then sync to repo and delete S3 file when workflow completes (status → Done)

## Details

### Problem

Currently, agent logs are written to local files (`agent-logs/issue-{N}.md`). This works for local agent execution but has a critical limitation:

- **Vercel serverless functions** (like Telegram webhooks) cannot write to local files
- This means webhook actions (approvals, merges, status changes) are NOT logged
- No unified log view across all sources

### Solution

Use S3 as a **temporary write buffer** during active workflows:

1. **During workflow:** All sources (local, GitHub Actions, Vercel webhooks) write to S3
2. **On workflow completion:** Sync S3 log to repo (`agent-logs/issue-{N}.md`), commit, and delete S3 file
3. **Benefits:**
   - Unified logging from all environments during active work
   - Final logs live in repo (easy access, version controlled, searchable)
   - Minimal S3 costs (files are temporary, deleted after sync)
   - No long-term S3 storage management needed

### References

- Current logging system: `docs/template/github-agents-workflow/agent-logging.md`
- Logger implementation: `src/agents/lib/logging/logger.ts`
- Webhook handler: `src/pages/api/telegram-webhook.ts`

## Implementation Notes

### Approach

1. **S3 Client Setup**
   - Add AWS SDK for S3 (`@aws-sdk/client-s3`)
   - Create S3 client wrapper in `src/agents/lib/logging/s3-writer.ts`
   - Environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_LOG_BUCKET`

2. **Log Writer Abstraction**
   - Create interface for log writers (local file vs S3)
   - S3 writer: append by read-modify-write (S3 doesn't support append)
   - Use optimistic locking with ETags for concurrent writes

3. **Update Logger Functions**
   - Modify `appendToLog()` to write to S3 when bucket is configured
   - Keep local file writes as fallback for local-only development
   - Add `AWS_S3_LOG_BUCKET` env var (if set, use S3; if not, use local)

4. **Webhook Integration**
   - Update `logWebhookAction()` and related functions to use S3 writer
   - Works on Vercel because S3 is network-accessible

5. **GitHub Actions Integration**
   - Add AWS credentials to GitHub secrets
   - Agents running in Actions will automatically use S3

6. **Workflow Completion: Sync & Cleanup** ⭐ NEW
   - When issue status changes to "Done":
     a. Download S3 log file content
     b. Write to local repo: `agent-logs/issue-{N}.md`
     c. Commit the log file to repo
     d. Delete S3 log file
   - Trigger point: Telegram webhook "Mark as Done" action or final PR merge
   - Function: `syncLogToRepoAndCleanup(issueNumber)`

### S3 Key Structure

```
agent-logs/
  issue-43.md    # Temporary - deleted after sync to repo
  issue-44.md
  ...
```

### Workflow Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│  ACTIVE WORKFLOW (S3 is primary storage)                    │
├─────────────────────────────────────────────────────────────┤
│  Local Agent → writes to S3                                 │
│  GitHub Action → writes to S3                               │
│  Telegram Webhook (Vercel) → writes to S3                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ Status → Done
┌─────────────────────────────────────────────────────────────┐
│  WORKFLOW COMPLETE (Sync & Cleanup)                         │
├─────────────────────────────────────────────────────────────┤
│  1. Download from S3: agent-logs/issue-{N}.md               │
│  2. Write to repo: agent-logs/issue-{N}.md                  │
│  3. Git commit: "chore: add agent log for issue #{N}"       │
│  4. Delete S3 file                                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  ARCHIVED (Repo is permanent storage)                       │
├─────────────────────────────────────────────────────────────┤
│  Log lives in git history forever                           │
│  Searchable with grep, readable in GitHub UI                │
│  No S3 costs for completed issues                           │
└─────────────────────────────────────────────────────────────┘
```

### Concurrency Handling

Since S3 doesn't support append operations, handle concurrent writes by:
- Use optimistic locking with ETags
- Retry on conflict with exponential backoff
- Max 3 retries before failing

## Files to Modify

- `src/agents/lib/logging/s3-writer.ts` - **New file** for S3 read/write/delete operations
- `src/agents/lib/logging/s3-sync.ts` - **New file** for sync-to-repo and cleanup logic
- `src/agents/lib/logging/writer.ts` - Add S3 writer as primary when bucket configured
- `src/agents/lib/logging/logger.ts` - Use S3 writer when configured
- `src/agents/lib/logging/index.ts` - Export new S3 functions
- `src/pages/api/telegram-webhook.ts` - Call `syncLogToRepoAndCleanup()` on "Done" action
- `.env.example` - Add AWS S3 environment variables
- `docs/template/github-agents-workflow/agent-logging.md` - Document S3 setup and lifecycle

## Dependencies

- AWS account with S3 bucket created
- IAM credentials with S3 read/write access

## Risks

- S3 doesn't support append - need read-modify-write which has race conditions (mitigated with ETag locking)
- Added latency for each log write due to network calls
- Sync-to-repo requires git credentials in the environment where "Done" is triggered
- If sync fails, S3 file remains (manual cleanup may be needed)

## Notes

**Key design decision:** S3 is temporary storage only. Final logs live in the git repo.

**Sync trigger points:**
- Telegram webhook: "Mark as Done" button
- Could also trigger on final PR merge if preferred

**Fallback behavior:**
- If `AWS_S3_LOG_BUCKET` is not set, falls back to local file logging (for local-only development)
- If sync-to-repo fails, log an error but don't block the workflow completion

**Cost optimization:**
- Files only exist in S3 during active workflows (typically hours to days)
- Automatic deletion after sync means no long-term storage costs
- API costs are minimal (few cents per 10,000 requests)
