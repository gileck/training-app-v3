/**
 * Issue reporter — forwards locally-saved bug reports / feature requests to an
 * external "AI assistant" app, where they become tasks in that app's project.
 *
 * SERVER-ONLY. The intake token is a secret and must never reach the client.
 * Lives under `src/server/template/**` so the import-boundary ESLint rule
 * blocks any client import.
 *
 * Configured via two env vars (both required; if either is missing this module
 * silently no-ops, so child projects that don't use the integration are
 * unaffected):
 *   - AI_ASSISTANT_REPORTS_URL    base URL/origin of the assistant app
 *                                 (e.g. https://my-assistant.vercel.app)
 *   - AI_ASSISTANT_REPORTS_TOKEN  project-scoped intake token (intk_…)
 *
 * The HTTP contract is owned by the assistant app's `POST /api/intake/report`.
 * Calls are fire-and-forget: failures are logged and never bubble up to fail
 * the user's report submission.
 */

import type {
    ReportDocument,
    SessionLogEntry,
} from '@/server/database/collections/template/reports/types';
import type { FeatureRequestDocument } from '@/server/database/collections/template/feature-requests/types';

const INTAKE_PATH = '/api/intake/report';
const MAX_TITLE_LEN = 120;
// Caps so a noisy session doesn't create an enormous task note.
const MAX_LOG_ENTRIES = 100;
const MAX_LOG_CHARS = 8000;
// Bound how long a report submission can wait on the assistant app. Callers
// AWAIT the forward (fire-and-forget doesn't survive serverless suspension),
// so this cap keeps a slow/unreachable receiver from hanging the submission.
const FORWARD_TIMEOUT_MS = 6000;

type IntakeType = 'bug' | 'feature';

interface IntakeMetadata {
    appVersion?: string;
    environment?: string;
    route?: string;
    severity?: string;
    category?: string;
    networkStatus?: string;
    userAgent?: string;
    errorMessage?: string;
    screenshot?: string;
    occurrenceCount?: string;
    sessionId?: string;
    stackTrace?: string;
    reporter?: string;
}

interface IntakePayload {
    type: IntakeType;
    title: string;
    description?: string;
    metadata?: IntakeMetadata;
    /** Pre-formatted debug/session log text; rendered as a fenced block. */
    logs?: string;
}

export interface ForwardResult {
    ok: boolean;
    /** True when the integration isn't configured (env vars absent) — not an error. */
    skipped?: boolean;
    taskId?: string;
    error?: string;
}

function readConfig(): { baseUrl: string; token: string } | null {
    const baseUrl = process.env.AI_ASSISTANT_REPORTS_URL?.trim();
    const token = process.env.AI_ASSISTANT_REPORTS_TOKEN?.trim();
    if (!baseUrl || !token) return null;
    return { baseUrl: baseUrl.replace(/\/+$/, ''), token };
}

/** Drop empty/whitespace-only metadata values so the payload stays clean. */
function pruneMetadata(meta: IntakeMetadata): IntakeMetadata | undefined {
    const out: IntakeMetadata = {};
    for (const [key, value] of Object.entries(meta)) {
        if (typeof value === 'string' && value.trim()) {
            out[key as keyof IntakeMetadata] = value.trim();
        }
    }
    return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * POST a report to the assistant app. Never throws — returns a result for
 * logging/testing. No-ops (skipped) when the integration isn't configured.
 */
export async function forwardToAssistant(
    payload: IntakePayload
): Promise<ForwardResult> {
    const config = readConfig();
    if (!config) return { ok: false, skipped: true };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FORWARD_TIMEOUT_MS);
    try {
        const response = await fetch(`${config.baseUrl}${INTAKE_PATH}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.token}`,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            console.error(
                `[issue-reporter] intake returned ${response.status}:`,
                text.slice(0, 500)
            );
            return { ok: false, error: `HTTP ${response.status}` };
        }

        const data = (await response.json().catch(() => ({}))) as {
            taskId?: string;
        };
        return { ok: true, taskId: data.taskId };
    } catch (error) {
        console.error('[issue-reporter] forward failed:', error);
        return {
            ok: false,
            error: error instanceof Error ? error.message : 'unknown error',
        };
    } finally {
        clearTimeout(timer);
    }
}

/** First non-empty line of `text`, truncated — used to derive a bug title. */
function firstLine(text: string | undefined, max: number): string {
    const line = (text ?? '').split('\n').map((l) => l.trim()).find(Boolean) ?? '';
    return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

/** Render the report's session/debug logs into a compact text block. */
function formatSessionLogs(logs: SessionLogEntry[] | undefined): string | undefined {
    if (!logs || logs.length === 0) return undefined;
    const recent = logs.slice(-MAX_LOG_ENTRIES);
    const text = recent
        .map((e) => {
            const route = e.route ? ` (${e.route})` : '';
            const meta =
                e.meta && Object.keys(e.meta).length > 0
                    ? ` ${JSON.stringify(e.meta)}`
                    : '';
            return `[${e.level.toUpperCase()}] ${e.timestamp} ${e.feature}: ${e.message}${route}${meta}`;
        })
        .join('\n');
    // Keep the tail (most recent) if over the cap.
    return text.length > MAX_LOG_CHARS ? text.slice(text.length - MAX_LOG_CHARS) : text;
}

/** Map a saved bug report → intake payload and forward it. */
export async function forwardBugReportToAssistant(
    report: ReportDocument
): Promise<ForwardResult> {
    const title =
        firstLine(report.description, MAX_TITLE_LEN) ||
        firstLine(report.errorMessage, MAX_TITLE_LEN) ||
        'Bug report';
    return forwardToAssistant({
        type: 'bug',
        title,
        description: report.description,
        metadata: pruneMetadata({
            reporter:
                report.userInfo?.username ||
                report.userInfo?.email ||
                report.userInfo?.userId,
            route: report.route,
            category: report.category,
            networkStatus: report.networkStatus,
            userAgent: report.browserInfo?.userAgent,
            errorMessage: report.errorMessage,
            stackTrace: report.stackTrace,
            screenshot: report.screenshot,
            occurrenceCount:
                report.occurrenceCount && report.occurrenceCount > 1
                    ? String(report.occurrenceCount)
                    : undefined,
        }),
        logs: formatSessionLogs(report.sessionLogs),
    });
}

/** Map a saved feature request → intake payload and forward it. */
export async function forwardFeatureRequestToAssistant(
    request: FeatureRequestDocument
): Promise<ForwardResult> {
    return forwardToAssistant({
        type: 'feature',
        title: request.title,
        description: request.description,
        metadata: pruneMetadata({
            route: request.page,
            reporter: request.requestedByName,
        }),
    });
}
