/**
 * Domain Configuration
 *
 * Seed domain suggestions for the triage agent prompt.
 * Domains are free-form strings — agents can reuse existing ones or create new ones.
 * These seeds provide initial guidance when no existing domains exist yet.
 */

export const SEED_DOMAINS = [
    { value: 'ui', description: 'User interface, components, pages, styling' },
    { value: 'api', description: 'Server endpoints, API handlers' },
    { value: 'database', description: 'MongoDB collections, schemas, queries' },
    { value: 'agents', description: 'AI agents, workflow pipeline' },
    { value: 'infra', description: 'Build, CI/CD, deployment, config' },
    { value: 'auth', description: 'Authentication, authorization' },
] as const;

/**
 * Normalize a domain string: lowercase and trim.
 * All domain values should pass through this before being saved.
 */
export function normalizeDomain(domain: string): string {
    return domain.trim().toLowerCase();
}
