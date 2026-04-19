/**
 * Error hierarchy for the __NAME__ SDK.
 *
 * All errors thrown by the SDK are subclasses of {@link __PASCAL__Error}.
 * Use `instanceof` to branch on category.
 */

/**
 * Server-side error codes returned in the `{ error, errorCode }` response body.
 * Open union — new codes may appear as the server evolves.
 */
export type ServerErrorCode =
  | 'UNKNOWN_API'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED'
  | 'INVALID_TOKEN'
  | 'SERVER_ERROR'
  | 'VALIDATION'
  | (string & {});

/** Abstract base class. Every SDK error extends this. */
export abstract class __PASCAL__Error extends Error {
  abstract readonly kind: 'validation' | 'api' | 'network' | 'response';

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = this.constructor.name;
    if (options?.cause !== undefined) {
      (this as unknown as { cause: unknown }).cause = options.cause;
    }
  }
}

/** Thrown before a request is sent when the caller passes invalid input. */
export class __PASCAL__ValidationError extends __PASCAL__Error {
  readonly kind = 'validation' as const;
  readonly field: string;
  readonly reason: string;

  constructor(field: string, reason: string) {
    super(`Invalid ${field}: ${reason}`);
    this.field = field;
    this.reason = reason;
  }
}

/** Thrown when the server returned a structured error envelope. */
export class __PASCAL__ApiError extends __PASCAL__Error {
  readonly kind = 'api' as const;
  readonly apiName: string;
  readonly errorCode: ServerErrorCode | undefined;

  constructor(apiName: string, errorCode: ServerErrorCode | undefined, message: string) {
    super(`[${apiName}] ${message}${errorCode ? ` (${errorCode})` : ''}`);
    this.apiName = apiName;
    this.errorCode = errorCode;
  }
}

/** Thrown on transport failure (DNS, abort/timeout, TLS, etc.). */
export class __PASCAL__NetworkError extends __PASCAL__Error {
  readonly kind = 'network' as const;
  readonly apiName: string;
  readonly isTimeout: boolean;

  constructor(apiName: string, message: string, options: { cause?: unknown; isTimeout?: boolean }) {
    super(`[${apiName}] ${message}`, { cause: options.cause });
    this.apiName = apiName;
    this.isTimeout = options.isTimeout ?? false;
  }
}

/** Thrown when the server response didn't match the `{ data, isFromCache }` envelope. */
export class __PASCAL__ResponseError extends __PASCAL__Error {
  readonly kind = 'response' as const;
  readonly apiName: string;
  readonly status: number;

  constructor(apiName: string, status: number, message: string, options?: { cause?: unknown }) {
    super(`[${apiName}] ${message} (HTTP ${status})`, options);
    this.apiName = apiName;
    this.status = status;
  }
}
