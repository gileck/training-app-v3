/**
 * App Shell Feature
 *
 * Template-owned application root. Intentionally NOT re-exported from the
 * `@/client/features` barrel: AppShell imports `@/client/routes`, and routing
 * back through the barrel would create an import cycle. Import it directly:
 *
 *     import { AppShell } from '@/client/features/template/app-shell';
 */
export { AppShell } from './AppShell';
export { TemplateAppBridges } from './TemplateAppBridges';
