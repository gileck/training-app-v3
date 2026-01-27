# Bug Fix: Unknown action in telegram "approve & merge" button in product design review message

## Root Cause Analysis

The bug occurs in `src/pages/api/telegram-webhook.ts` when a Telegram callback query doesn't match any of the registered action handlers. Specifically:

**Location:** Line 1706 in `telegram-webhook.ts`

**The Problem:**
When a user clicks the "Approve & Merge" button (or any other Telegram inline button), the webhook receives a `callback_data` string that should match one of the registered action patterns. However, if the callback_data doesn't match any handler (lines 1420-1703), the code falls through to line 1706 which shows "Unknown action" to the user.

**Critical Issues:**
1. **No diagnostic logging** - The webhook doesn't log what `callback_data` was received, making it impossible to debug why it didn't match
2. **No error context** - The user sees "Unknown action" but has no information about what went wrong
3. **Silent failure** - No console.error or warning is logged, so server logs don't capture the issue

**Why this happens:**
- Callback data format mismatch (e.g., extra colons, missing parts, URL encoding issues)
- New action types added to notifications but not yet handled in webhook
- Telegram API changes or encoding issues
- Race conditions where PR/issue is deleted between notification and button click

**Current Flow:**
```
User clicks "Approve & Merge" 
→ Telegram sends callback_query with data: "design_approve:123:456:product"
→ Webhook parses: parts = ["design_approve", "123", "456", "product"]
→ Checks if action === 'design_approve' && parts.length === 4
→ If no match found, falls through to line 1706
→ Returns "Unknown action" (no logging!)
```

## Affected Components

**Primary File:**
- `src/pages/api/telegram-webhook.ts`
  - Lines 1405-1416: Callback data parsing
  - Lines 1418-1703: Action routing logic
  - Line 1706: Unknown action fallback (THE BUG)
  - Lines 1708-1732: Error handling

**Related Files (context only, no changes needed):**
- `src/agents/shared/notifications.ts` - Sends notifications with callback buttons
  - Line 595: Creates "Approve & Merge" button with `design_approve:${prNumber}:${issueNumber}:${designType}`

## Fix Approach

### 1. Add Comprehensive Logging
Add detailed logging when an unknown action is received to capture:
- The full `callback_data` string
- Parsed `action` and `parts`
- Callback query metadata (user, message ID, chat ID)
- Timestamp of the request

### 2. Improve Error Message
Provide better user feedback that:
- Explains what went wrong
- Suggests next steps (e.g., "Please try again or contact support")
- Includes truncated callback data for user reference

### 3. Add Server-Side Error Reporting
- Log to console.error (not just console.log) for visibility in monitoring
- Include full context for debugging
- Potentially notify admin via Telegram for critical unknown actions

### 4. Update Message with Error Details
When unknown action occurs:
- Edit the original Telegram message to show the error
- Keep the message visible (don't remove buttons) so user can see what they clicked
- Provide context about the failure

## Files to Modify

**`src/pages/api/telegram-webhook.ts`**

- **Line 1705-1707 (Unknown action handler):**
  - Add comprehensive error logging before answering callback query
  - Log the full callback_data, parsed action, parts array, and callback query details
  - Use console.error instead of silent failure
  - Include structured logging for easier monitoring/alerting

- **Line 1706 (answerCallbackQuery):**
  - Improve error message from "Unknown action" to more descriptive text
  - Include truncated callback_data in the toast message for user context
  - Example: "Unknown action: design_approve:... (see message for details)"

- **After Line 1706 (Add message edit):**
  - Add editMessageText call to update the original message with error details
  - Show what callback_data was received
  - Provide troubleshooting guidance
  - Keep inline keyboard visible so user can retry

- **Optional Enhancement - Line 1412-1416 (Callback data validation):**
  - Add early validation and logging of callback_data format
  - Log when callback_data is empty, null, or malformed
  - This helps catch issues before action routing

## Code Changes

### Change 1: Add detailed error logging (Line 1705-1707)

**Before:**
```typescript
// Unknown action
await answerCallbackQuery(botToken, callback_query.id, 'Unknown action');
return res.status(200).json({ ok: true });
```

**After:**
```typescript
// Unknown action - log for debugging
console.error('Telegram webhook: Unknown action received', {
    callbackData: callbackData,
    action: action,
    parts: parts,
    partsLength: parts.length,
    callbackQueryId: callback_query.id,
    userId: callback_query.from.id,
    username: callback_query.from.username,
    messageId: callback_query.message?.message_id,
    timestamp: new Date().toISOString(),
});

const truncatedData = callbackData.length > 50 
    ? `${callbackData.slice(0, 50)}...` 
    : callbackData;

await answerCallbackQuery(
    botToken, 
    callback_query.id, 
    `⚠️ Unknown action: ${truncatedData}`
);

// Edit message to show error details
if (callback_query.message) {
    const originalText = callback_query.message.text || '';
    const errorDetails = [
        '',
        '━━━━━━━━━━━━━━━━━━━━',
        '⚠️ <b>Unknown Action</b>',
        '',
        `Received callback: <code>${escapeHtml(callbackData)}</code>`,
        '',
        'This action is not recognized by the webhook handler.',
        'Please try again or contact support if the issue persists.',
    ].join('\n');

    try {
        await editMessageText(
            botToken,
            callback_query.message.chat.id,
            callback_query.message.message_id,
            originalText + errorDetails,
            'HTML'
        );
    } catch (editError) {
        console.error('Failed to edit message for unknown action:', editError);
    }
}

return res.status(200).json({ ok: true });
```

### Change 2: Add helper function for HTML escaping (if not exists)

Note: The `escapeHtml` function is not currently defined in the webhook file. We need to add it or use the existing text without escaping (less safe but functional).

**Option A - Add escapeHtml function:**
```typescript
/**
 * Escape HTML special characters for Telegram HTML mode
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
```

**Option B - Use plain text without HTML tags:**
```typescript
// In the error message, replace <code> tags with backticks
`Received callback: \`${callbackData}\``
```

### Change 3: Optional - Add early callback data validation (Line 1407-1410)

**Add after line 1410:**
```typescript
if (!callbackData) {
    console.error('Telegram webhook: Empty callback data received', {
        callbackQueryId: callback_query.id,
        userId: callback_query.from.id,
        timestamp: new Date().toISOString(),
    });
    await answerCallbackQuery(botToken, callback_query.id, 'Invalid callback');
    return res.status(200).json({ ok: true });
}

// Log all incoming callback data for debugging (can be removed after issue is resolved)
console.log('Telegram webhook: Received callback', {
    callbackData: callbackData,
    userId: callback_query.from.id,
});
```

## Testing Strategy

### Manual Testing

1. **Reproduce the bug:**
   - Trigger a product design agent run
   - Wait for "Approve & Merge" button in Telegram
   - Click the button
   - Verify if "Unknown action" appears

2. **Test with modified code:**
   - Deploy the fix to staging/dev environment
   - Trigger the same flow
   - If unknown action still occurs, verify:
     - Console logs show the full callback_data
     - Telegram message shows error details
     - Toast notification shows truncated callback

3. **Test valid actions:**
   - Verify all existing actions still work correctly:
     - `approve_request:requestId`
     - `approve_bug:reportId`
     - `route_feature:requestId:destination`
     - `route_bug:reportId:destination`
     - `approve:issueNumber`, `changes:issueNumber`, `reject:issueNumber`
     - `clarified:issueNumber`
     - `merge:issueNumber:prNumber`
     - `reqchanges:issueNumber:prNumber`
     - `design_approve:prNumber:issueNumber:type`
     - `design_changes:prNumber:issueNumber:type`

4. **Test edge cases:**
   - Malformed callback data (extra colons, missing parts)
   - Empty callback data
   - Very long callback data (>64 bytes - Telegram limit)
   - Special characters in callback data

### Verification Steps

1. **Check server logs:**
   - Verify unknown action errors are logged to console
   - Verify structured data is included (callback_data, action, parts, etc.)
   - Verify timestamp is included

2. **Check Telegram UX:**
   - Toast notification shows helpful error message
   - Original message is edited to show error details
   - User can see what callback_data was sent
   - Message provides guidance on next steps

3. **Monitor production:**
   - After deployment, monitor logs for "Unknown action" errors
   - If errors occur, analyze logged callback_data to identify pattern
   - Update webhook handlers to support any missing action types

### Regression Testing

- Verify all 10 existing action types still work correctly
- Test both success and error paths for each action
- Verify error handling in try-catch block still works
- Test with missing TELEGRAM_BOT_TOKEN
- Test with invalid callback query format

## Risk Assessment

### Low Risk Changes
- Adding console.error logging - no functional impact
- Improving error messages - better UX, no breaking changes
- Editing message on unknown action - improves user experience

### Potential Side Effects
1. **Log volume increase:** If unknown actions are frequent, console logs may grow
   - Mitigation: Monitor log volume after deployment
   - Can add rate limiting or sampling if needed

2. **Message editing failures:** If editMessageText fails, user won't see details
   - Mitigation: Already wrapped in try-catch, logs error but doesn't break flow

3. **Telegram API rate limits:** Additional API calls (editMessageText) could hit limits
   - Mitigation: Unknown actions should be rare; if not, indicates bigger issue to fix

### Edge Cases to Consider

1. **Race condition:** User clicks button after PR/issue is deleted
   - Current behavior: Would show error from handler
   - New behavior: Better error message if action itself is unrecognized

2. **Encoding issues:** Callback data contains special characters
   - escapeHtml function handles this
   - Truncation prevents overly long messages

3. **Telegram message already edited:** If user clicks button multiple times rapidly
   - First click processes normally
   - Subsequent clicks may fail to edit (message already edited)
   - Error is caught and logged, doesn't break webhook

## Implementation Notes

### Why "Unknown action" occurs

The root cause needs to be identified from logs after implementing this fix. Possible causes:

1. **Callback data format changed** - Notifications send one format, webhook expects another
2. **New action type added** - Code added new button but forgot to add webhook handler  
3. **Telegram encoding issue** - Special characters or URL encoding corrupts callback_data
4. **Race condition** - Notification sent with old format, webhook updated with new format

### Post-Deployment Actions

After deploying this fix:

1. **Monitor logs** for "Unknown action" errors
2. **Analyze callback_data** from logs to identify the actual format being sent
3. **Add missing handler** if a new action type is discovered
4. **Update notification code** if callback_data format is incorrect
5. **Add regression test** to prevent the specific issue from recurring

### Long-Term Improvements (not in scope)

1. **Centralize callback data format** - Create constants for all callback patterns
2. **Add callback data builder** - Helper functions to construct callback_data strings
3. **Add callback data validator** - Validate format before sending notification
4. **Add integration tests** - Test full flow from notification to webhook handler
5. **Add monitoring/alerting** - Alert when unknown actions exceed threshold

### Related Documentation

After fixing, update:
- `docs/github-agents-workflow/telegram-integration.md` - Document all callback patterns
- `docs/github-agents-workflow/troubleshooting.md` - Add section on debugging unknown actions
- Add comments in code explaining callback_data format for each action type
