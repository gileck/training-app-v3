/**
 * Template Routes
 *
 * These are core routes provided by the template.
 * Do not modify this file - it will be overwritten during template sync.
 *
 * To add project-specific routes, add them to index.ts instead.
 */

import { Settings } from './Settings';
import { Profile } from './Profile';
import { Reports } from './Reports';
import { FeatureRequests } from './FeatureRequests';
import { MyFeatureRequests } from './MyFeatureRequests';
import { NotFound } from './NotFound';
import { Theme } from './Theme';
import { Routes } from '../router';

/**
 * Template route definitions.
 * These are merged with project routes in index.ts.
 */
export const templateRoutes: Routes = {
  // Template protected routes
  '/settings': Settings,
  '/theme': Theme,
  '/profile': Profile,
  '/my-requests': MyFeatureRequests,

  // Admin routes
  '/admin/reports': Reports,
  '/admin/feature-requests': FeatureRequests,

  // Fallback
  '/not-found': NotFound,
};
