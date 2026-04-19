import {
  ServerErrorCode,
  __PASCAL__ApiError,
  __PASCAL__NetworkError,
  __PASCAL__ResponseError,
} from './errors';
import { assertNonEmptyString } from './validation';

/** Options for {@link createClient}. */
export interface ClientOptions {
  /** Base URL of the deployed app. Trailing slash is optional. */
  baseUrl: string;

  /**
   * The `ADMIN_API_TOKEN` configured on the server. Shared secret granting
   * access to every user's data — treat a leak as rotate-and-redeploy.
   */
  adminToken: string;

  /**
   * MongoDB `_id` of the user that calls should act on behalf of. Sent as
   * `X-On-Behalf-Of` on every request.
   */
  userId: string;

  /**
   * Per-request timeout in ms. Throws __PASCAL__NetworkError with
   * `isTimeout=true` on expiry. Defaults to 30_000. Pass 0 to disable.
   */
  timeoutMs?: number;

  /** Optional fetch override (for tests or Node < 18). */
  fetch?: typeof fetch;
}

/** Envelope every `/api/process/*` endpoint returns. HTTP status is always 200. */
export interface CacheResult<T> {
  data: T | { error: string; errorCode?: ServerErrorCode };
  isFromCache: boolean;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Low-level POST to `/api/process/{api_name}`. Slashes in `apiName` become
 * underscores in the URL segment (per template convention).
 *
 * @throws {__PASCAL__ApiError} server returned an error envelope.
 * @throws {__PASCAL__NetworkError} fetch failed or timed out.
 * @throws {__PASCAL__ResponseError} response wasn't JSON or didn't match envelope.
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
    throw new __PASCAL__NetworkError(
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
    const body = await safeReadText(res);
    throw new __PASCAL__ResponseError(
      apiName,
      res.status,
      `unexpected HTTP status${body ? `: ${truncate(body, 200)}` : ''}`,
    );
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch (err) {
    throw new __PASCAL__ResponseError(apiName, res.status, 'response was not valid JSON', {
      cause: err,
    });
  }

  if (!isCacheResult(body)) {
    throw new __PASCAL__ResponseError(
      apiName,
      res.status,
      'response did not match { data, isFromCache } envelope',
    );
  }

  const data = body.data;
  if (isErrorPayload(data)) {
    throw new __PASCAL__ApiError(apiName, data.errorCode, data.error);
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
