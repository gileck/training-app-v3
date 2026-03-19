/**
 * Vitest global setup — runs before any test module is loaded.
 *
 * Sets required environment variables so modules with module-scope guards
 * (e.g. agent-decision/utils.ts, auth/shared.ts) do not throw during
 * the static import phase of E2E test files.
 *
 * Per-test values are overridden in setupBoundaries() as needed.
 */

process.env.CLARIFICATION_SECRET = process.env.CLARIFICATION_SECRET ?? 'test-secret-for-e2e';
