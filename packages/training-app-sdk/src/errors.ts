/**
 * Error hierarchy for the training app SDK.
 *
 * All errors thrown by the SDK are subclasses of {@link TrainingAppError}.
 * Use `instanceof` to branch on category, and read the typed fields below
 * to act on specific failure modes.
 *
 * @example
 * ```ts
 * try {
 *   await client.plans.get(id);
 * } catch (e) {
 *   if (e instanceof TrainingAppValidationError) {
 *     // Client-side: you passed a bad argument. Fix your code.
 *   } else if (e instanceof TrainingAppApiError) {
 *     // Server rejected the call. Inspect e.errorCode.
 *   } else if (e instanceof TrainingAppNetworkError) {
 *     // Transport failure. Retry may help.
 *   } else if (e instanceof TrainingAppResponseError) {
 *     // Server returned a shape the SDK can't parse. Probably a version skew.
 *   }
 * }
 * ```
 */

/**
 * Server-side error codes returned in the `{ error, errorCode }` response body.
 * The list is open-ended — new codes may appear as the server evolves. The
 * string union type helps autocomplete; unknown codes fall through as plain strings.
 */
export type ServerErrorCode =
  | 'UNKNOWN_API'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED'
  | 'INVALID_TOKEN'
  | 'SERVER_ERROR'
  | 'VALIDATION'
  | 'PLAN_NOT_FOUND'
  | 'DRAFT_MISMATCH'
  | 'AI_INVALID_OUTPUT'
  | 'AI_UNCLEAR_INPUT'
  | (string & {});

/** Abstract base class. Every SDK error extends this. */
export abstract class TrainingAppError extends Error {
  /** Short machine-readable kind: 'validation' | 'api' | 'network' | 'response'. */
  abstract readonly kind: 'validation' | 'api' | 'network' | 'response';

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = this.constructor.name;
    if (options?.cause !== undefined) {
      (this as unknown as { cause: unknown }).cause = options.cause;
    }
  }
}

/**
 * Thrown before a request is sent when the caller passes invalid input
 * (missing required field, wrong type, out-of-range value, etc.).
 *
 * These are programming errors — fix the call site; retrying will not help.
 */
export class TrainingAppValidationError extends TrainingAppError {
  readonly kind = 'validation' as const;
  /** Dotted path of the offending field, e.g. `"input.planId"`. */
  readonly field: string;
  /** Human-readable reason, e.g. `"must be a non-empty string"`. */
  readonly reason: string;

  constructor(field: string, reason: string) {
    super(`Invalid ${field}: ${reason}`);
    this.field = field;
    this.reason = reason;
  }
}

/**
 * Thrown when the server returned an error envelope `{ error, errorCode }`.
 * The request reached the server, was processed, and failed in a structured way.
 *
 * `errorCode` is the taxonomy from the server; see {@link ServerErrorCode}.
 * `apiName` is the slash-delimited API, e.g. `"training-plans/get"`.
 */
export class TrainingAppApiError extends TrainingAppError {
  readonly kind = 'api' as const;
  readonly apiName: string;
  readonly errorCode: ServerErrorCode | undefined;

  constructor(apiName: string, errorCode: ServerErrorCode | undefined, message: string) {
    super(`[${apiName}] ${message}${errorCode ? ` (${errorCode})` : ''}`);
    this.apiName = apiName;
    this.errorCode = errorCode;
  }
}

/**
 * Thrown when the HTTP transport itself failed: connection reset, DNS failure,
 * request aborted (timeout), TLS error, etc. The server never received or never
 * returned a usable response.
 *
 * `cause` holds the underlying fetch/TypeError when available.
 */
export class TrainingAppNetworkError extends TrainingAppError {
  readonly kind = 'network' as const;
  readonly apiName: string;
  /** True when the request was aborted by our own timeout. */
  readonly isTimeout: boolean;

  constructor(apiName: string, message: string, options: { cause?: unknown; isTimeout?: boolean }) {
    super(`[${apiName}] ${message}`, { cause: options.cause });
    this.apiName = apiName;
    this.isTimeout = options.isTimeout ?? false;
  }
}

/**
 * Thrown when the server returned a successful-ish HTTP response but the body
 * did not match the `{ data, isFromCache }` envelope the SDK expects.
 *
 * Usually indicates a version skew between client and server — the SDK is
 * talking to an endpoint that doesn't speak the processApiCall contract
 * (e.g. raw Next.js route, a 4xx HTML error page).
 */
export class TrainingAppResponseError extends TrainingAppError {
  readonly kind = 'response' as const;
  readonly apiName: string;
  readonly status: number;

  constructor(apiName: string, status: number, message: string, options?: { cause?: unknown }) {
    super(`[${apiName}] ${message} (HTTP ${status})`, options);
    this.apiName = apiName;
    this.status = status;
  }
}
