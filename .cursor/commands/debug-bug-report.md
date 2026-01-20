# Debug Bug Report

You are debugging a bug/error report from the application. Analyze the provided report systematically to find the root cause.

## Getting Report Data

### Option 1: List New Reports

If the user hasn't provided a specific report ID, list new reports from the database:

```bash
node scripts/list-reports.mjs
```

This shows all new reports with their IDs. You can filter by status or type:

```bash
# List reports by status (new, investigating, resolved, closed)
node scripts/list-reports.mjs --status investigating

# List reports by type (bug, error)
node scripts/list-reports.mjs --type error

# Combine filters and set limit
node scripts/list-reports.mjs --status new --type bug --limit 20
```

The output includes:
- Report ID (use this to fetch full details)
- Type, status, and creation date
- Route where the issue occurred
- Brief message/description

### Option 2: Fetch Specific Report

If the user provides a **report ID** (24-character hex string like `692f08157586bdebbe6f3042`), fetch the full report details:

```bash
node scripts/get-report.mjs <report-id>
```

This script connects directly to MongoDB and outputs the complete report details.

## Typical Workflow

1. **List reports** - Run `node scripts/list-reports.mjs` to see available reports
2. **Select a report** - Pick a report ID from the list
3. **Fetch full details** - Run `node scripts/get-report.mjs <report-id>`
4. **Analyze** - Follow the analysis steps below
5. **Debug** - Investigate the issue and propose a fix

## Input

The user will provide either:
1. **Nothing** → List new reports and ask user which one to debug
2. **A report ID** → Fetch full details using `get-report.mjs`
3. **A full report** → Analyze directly (user copied the report data)

Report format includes:
- Report metadata (type, status, timestamps)
- Context (route, network status)
- Description or error message
- Stack trace (for errors)
- User and browser information
- Performance entries (for performance bugs)
- Session logs with timestamps and performance timing
- Screenshot (optional) - Public URL to Vercel Blob storage

## Analysis Steps

### 1. Identify the Issue Type

- **Error**: Look at the error message and stack trace
- **Bug**: Read the user's description carefully
- **Performance**: Analyze performance entries and timing data

### 2. Analyze Session Logs

Session logs show the sequence of events leading to the issue:

```
[timestamp] [+Xms] [LEVEL] [feature] Message | Meta: {...} | Route: /path | Network: online/offline
```

- **Timeline**: Use `[+Xms]` to understand timing between events
- **API calls**: Look for `[api]` logs showing requests/responses
- **Errors**: Look for `[ERROR]` level logs
- **Network**: Check for network status changes (`[network]` logs)
- **User actions**: Component logs show what the user was doing

### 3. For Errors - Analyze Stack Trace

1. Find the originating file and line number
2. Search the codebase for that file
3. Read the relevant code section
4. Identify what could cause the error

### 4. For Performance Issues

Analyze performance entries:
- **Navigation timing**: How long did the page take to load?
- **Resource timing**: Which resources are slow?
- **API timing**: Which API calls are slow?
- **First Paint / FCP**: When did content first appear?

Look for:
- Resources with high duration (>500ms)
- API calls with high latency
- Large transfer sizes
- Waterfall blocking issues

### 5. Analyze Screenshot (if available)

If the report includes a screenshot URL (public Vercel Blob URL):

1. **Navigate to the screenshot** using the browser tools:
   ```typescript
   mcp_cursor-ide-browser_browser_navigate({ url: "screenshot-url" })
   mcp_cursor-ide-browser_browser_take_screenshot()
   ```

2. **Visual analysis** - Look for:
   - UI state that might indicate the issue (error messages, loading states, broken layouts)
   - What page/route the user was on
   - What actions they might have been taking
   - Any visible errors or unexpected UI states
   - Network/console errors visible in dev tools (if captured)
   - Form states or data that might be relevant

3. **Correlate with description**: Match what you see in the screenshot with the user's description

### 6. Correlate All Data

- Match session log timestamps with performance entries
- Check if network status changes correlate with issues
- Cross-reference screenshot with the reported route and timing
- Identify the exact moment things went wrong

## Debugging Actions

After analysis, take these actions:

1. **View the screenshot** (if provided):
   - Navigate to the screenshot URL using browser tools
   - Take a screenshot to see the visual context
   - Note any visible UI issues or states

2. **Search the codebase** for relevant files mentioned in:
   - Stack traces
   - Session log features
   - Routes
   - Components visible in screenshot

3. **Read the source code** at the identified locations

4. **Identify the root cause** by understanding:
   - What the code is trying to do
   - What state/data it expects
   - What could cause it to fail
   - What the screenshot reveals about the actual state

5. **Propose a fix** with specific code changes

## Output Format

Provide your analysis in this structure:

### Summary
Brief description of what happened

### Root Cause
The specific reason for the bug/error

### Evidence
- Relevant session log entries
- Stack trace analysis
- Performance data (if applicable)
- Screenshot analysis (if available)

### Affected Code
File paths and code sections involved

### Recommended Fix
Specific code changes to resolve the issue

---

## Report to Debug

{paste the bug/error report here}

