/**
 * @__NAME__/sdk — programmatic access to __NAME__.
 *
 * Call `createClient({ baseUrl, adminToken, userId })` and then use the typed
 * domain methods or the escape hatch `client.call<T>(apiName, params)` for
 * APIs that don't have a wrapper yet.
 */

import { callApi, ClientOptions } from './http';
import { adminDomain } from './admin';
import { pingDomain } from './ping';
import { assertNonEmptyString } from './validation';

export {
  __PASCAL__Error,
  __PASCAL__ApiError,
  __PASCAL__NetworkError,
  __PASCAL__ResponseError,
  __PASCAL__ValidationError,
} from './errors';
export type { ServerErrorCode } from './errors';

export type { ClientOptions, CacheResult } from './http';
export { callApi } from './http';

export type { AdminUserSummary, AdminUsersListResponse } from './admin';
export type { PingResponse } from './ping';

/**
 * Create a typed client. Validates required options upfront — throws
 * __PASCAL__ValidationError if baseUrl/adminToken/userId is missing.
 *
 * @example
 * ```ts
 * import { createClient } from '@__NAME__/sdk';
 *
 * const client = createClient({
 *   baseUrl: 'https://my-app.example.com',
 *   adminToken: process.env.__UPPER___TOKEN!,
 *   userId: '65f0...e1',
 * });
 * ```
 */
export function createClient(opts: ClientOptions): __PASCAL__Client {
  assertNonEmptyString(opts.baseUrl, 'opts.baseUrl');
  assertNonEmptyString(opts.adminToken, 'opts.adminToken');
  assertNonEmptyString(opts.userId, 'opts.userId');

  return {
    ping: pingDomain(opts),
    admin: adminDomain(opts),

    /** Return a new client scoped to a different user. */
    asUser: (userId: string) => {
      assertNonEmptyString(userId, 'userId');
      return createClient({ ...opts, userId });
    },

    /** Escape hatch for APIs without a typed wrapper. */
    call: <T = unknown>(apiName: string, params?: unknown): Promise<T> =>
      callApi<T>(opts, apiName, params),
  };
}

export interface __PASCAL__Client {
  ping: ReturnType<typeof pingDomain>;
  admin: ReturnType<typeof adminDomain>;
  asUser: (userId: string) => __PASCAL__Client;
  call: <T = unknown>(apiName: string, params?: unknown) => Promise<T>;
}
