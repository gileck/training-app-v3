/**
 * Compact human-readable label for a tool_result event. Adapters call
 * this when emitting each tool_result AgentEvent so the timeline UI
 * has a short summary without having to expand the full payload.
 *
 * The label semantics depend on convention keys on `result.data`
 * (`saved`, `updated`, `deleted`, `requiresApproval`, etc.). Adopt
 * those keys in your tool implementations and the timeline UI lights
 * up automatically.
 */

import type { ToolResult } from './types';

export function summarizeToolResult(name: string, result: ToolResult): string {
    if (!result.ok) return `Error: ${result.error ?? 'unknown'}`;
    if (result.truncated) return 'Returned (truncated)';
    if (Array.isArray(result.data)) return `Returned ${result.data.length} item(s)`;
    if (result.data && typeof result.data === 'object') {
        const d = result.data as Record<string, unknown>;
        // ask_user returns { responses: [{ question, selected, other? }] }.
        if (Array.isArray(d.responses)) {
            const picked: string[] = [];
            for (const r of d.responses as Array<{
                selected?: unknown;
                other?: unknown;
            }>) {
                if (Array.isArray(r.selected)) {
                    for (const s of r.selected) {
                        if (typeof s === 'string') picked.push(s);
                    }
                }
                if (typeof r.other === 'string' && r.other.trim()) {
                    picked.push(`“${r.other.trim()}”`);
                }
            }
            return picked.length > 0
                ? `User chose: ${picked.join(', ')}`
                : 'User made no selection';
        }
        if (d.requiresApproval === true) return 'Requires user approval';
        if (d.saved === true) return 'Saved';
        if (d.updated === true) return 'Updated';
        if (d.deleted === true) return 'Deleted';
        if (d.completed === true) return 'Completed';
        if (d.registered === true) return 'Registered';
    }
    return `${name} ok`;
}
