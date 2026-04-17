import {
  ServerErrorCode,
  TrainingAppApiError,
  TrainingAppNetworkError,
  TrainingAppResponseError,
} from './errors';
import { assertNonEmptyString } from './validation';

/**
 * Options for {@link createClient}.
 *
 * @example
 * ```ts
 * const client = createClient({
 *   baseUrl: 'https://training.example.com',
 *   adminToken: process.env.TRAINING_APP_TOKEN!,
 *   userId: '65f0...e1',
 *   timeoutMs: 15_000,
 * });
 * ```
 */
export interface ClientOptions {
  /**
   * Base URL of the deployed training app. Trailing slash is optional.
   * Example: `https://training.vercel.app`.
   */
  baseUrl: string;

  /**
   * The `ADMIN_API_TOKEN` configured on the server. This is a shared secret
   * that grants access to *every* user's data — treat a leak as a
   * rotate-and-redeploy incident.
   */
  adminToken: string;

  /**
   * MongoDB `_id` of the user that calls should act on behalf of. Sent as the
   * `X-On-Behalf-Of` header on every request.
   *
   * **Note**: This is the user's id, not their username. Sending a wrong id
   * here will silently target the wrong account.
   */
  userId: string;

  /**
   * Per-request timeout in milliseconds. When exceeded, the request is aborted
   * and a {@link TrainingAppNetworkError} with `isTimeout=true` is thrown.
   * Defaults to `30_000` (30 seconds). Pass `0` to disable.
   */
  timeoutMs?: number;

  /**
   * Optional fetch override. Useful for tests or for environments that don't
   * expose a global `fetch` (Node < 18). Must match the WHATWG fetch signature.
   */
  fetch?: typeof fetch;
}

/**
 * The envelope every `/api/process/*` endpoint returns. HTTP status is always
 * 200; success vs failure is encoded in the body as `{ data }` vs
 * `{ data: { error, errorCode } }`.
 */
export interface CacheResult<T> {
  data: T | { error: string; errorCode?: ServerErrorCode };
  isFromCache: boolean;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Low-level POST to `/api/process/{api_name}`. Slashes in `apiName` are
 * converted to underscores in the URL segment (per the template convention).
 *
 * Callers normally use a typed domain method instead; this is exposed via
 * `client.call()` as an escape hatch for APIs not yet wrapped.
 *
 * @throws {TrainingAppApiError} when the server returns an error envelope.
 * @throws {TrainingAppNetworkError} when fetch itself fails, or when the
 *   configured timeout is exceeded.
 * @throws {TrainingAppResponseError} when the HTTP response isn't JSON or
 *   doesn't match the expected envelope.
 */
export async function callApi<T>(opts: ClientOptions, apiName: string, params?: unknown): Promise<T> {
  assertNonEmptyString(apiName, 'apiName');

  const doFetch = opts.fetch ?? fetch;
  const url = `${opts.baseUrl.replace(/\/$/, '')}/api/process/${apiName.replace(/\//g, '_')}`;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = timeoutMs > 0 ? new AbortController() : null;
  const timeoutHandle = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  let res: Response;
  try {
    res = await doFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.adminToken}`,
        'X-On-Behalf-Of': opts.userId,
      },
      body: JSON.stringify({ params: params ?? {} }),
      signal: controller?.signal,
    });
  } catch (err) {
    const aborted = isAbortError(err);
    throw new TrainingAppNetworkError(
      apiName,
      aborted
        ? `request aborted after ${timeoutMs}ms`
        : `fetch failed: ${(err as Error)?.message ?? String(err)}`,
      { cause: err, isTimeout: aborted },
    );
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }

  if (!res.ok) {
    // Server returned non-2xx. Bodies may or may not be JSON.
    const body = await safeReadText(res);
    throw new TrainingAppResponseError(
      apiName,
      res.status,
      `unexpected HTTP status${body ? `: ${truncate(body, 200)}` : ''}`,
    );
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch (err) {
    throw new TrainingAppResponseError(apiName, res.status, 'response was not valid JSON', {
      cause: err,
    });
  }

  if (!isCacheResult(body)) {
    throw new TrainingAppResponseError(
      apiName,
      res.status,
      'response did not match { data, isFromCache } envelope',
    );
  }

  const data = body.data;
  if (isErrorPayload(data)) {
    throw new TrainingAppApiError(apiName, data.errorCode, data.error);
  }

  return data as T;
}

function isCacheResult(body: unknown): body is CacheResult<unknown> {
  return (
    typeof body === 'object' &&
    body !== null &&
    'data' in body &&
    'isFromCache' in (body as Record<string, unknown>)
  );
}

function isErrorPayload(value: unknown): value is { error: string; errorCode?: ServerErrorCode } {
  if (typeof value !== 'object' || value === null) return false;
  const maybe = value as Record<string, unknown>;
  return typeof maybe.error === 'string';
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: unknown }).name;
  return name === 'AbortError';
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
