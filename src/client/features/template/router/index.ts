/**
 * Router Feature
 *
 * Provides routing functionality and route persistence for PWA instant boot.
 */

export { useRouteStore, useLastRoute } from './store';
export {
  useRouter,
  RouterProvider,
  createRoutes,
  getCurrentPath,
  isPublicRoute,
  getRouteConfig,
} from './Router';
export type { RouteConfig, RouteDefinition, Routes } from './Router';

