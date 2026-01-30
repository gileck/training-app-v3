/**
 * Template Routes
 *
 * These are core routes provided by the template (settings, admin, etc.).
 * Do not modify this file - it will be overwritten during template sync.
 *
 * To add project-specific routes, add them to index.project.ts instead.
 */

import { Settings } from './Settings';
import { Profile } from './Profile';
import { Reports } from './Reports';
import { FeatureRequests, FeatureRequestDetail } from './FeatureRequests';
import { MyFeatureRequests } from './MyFeatureRequests';
import { NotFound } from './NotFound';
import { Theme } from './Theme';
import { Clarify } from './Clarify';
import { Routes } from '../router';

/**
 * Template route definitions.
 * These are universal routes that all projects need.
 * App-specific routes (Home, Todos, etc.) belong in index.project.ts.
 */
export const templateRoutes: Routes = {
  // Clarification page (public, full-screen - no header/navbar)
  '/clarify/:issueNumber': { component: Clarify, public: true, fullScreen: true },

  // Template protected routes
  '/settings': Settings,
  '/theme': Theme,
  '/profile': Profile,
  '/my-requests': MyFeatureRequests,

  // Admin routes
  '/admin/reports': Reports,
  '/admin/feature-requests': FeatureRequests,
  '/admin/feature-requests/:requestId': FeatureRequestDetail,

  // Fallback
  '/not-found': NotFound,
};
