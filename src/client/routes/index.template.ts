/**
 * Template Routes
 *
 * These are core routes provided by the template (settings, admin, etc.).
 * Do not modify this file - it will be overwritten during template sync.
 *
 * To add project-specific routes, add them to index.project.ts instead.
 */

import { Settings } from './template/Settings';
import { Profile } from './template/Profile';
import { Reports } from './template/Reports';
import { FeatureRequests, FeatureRequestDetail } from './template/FeatureRequests';
import { MyFeatureRequests } from './template/MyFeatureRequests';
import { NotFound } from './template/NotFound';
import { Theme } from './template/Theme';
import { Clarify } from './template/Clarify';
import { BugFix } from './template/BugFix';
import { Decision } from './template/Decision';
import { ItemDetail } from './template/ItemDetail';
import { WorkflowItems } from './template/Workflow';
import { Routes } from '../features/template/router';

/**
 * Template route definitions.
 * These are universal routes that all projects need.
 * App-specific routes (Home, Todos, etc.) belong in index.project.ts.
 */
export const templateRoutes: Routes = {
  // Clarification page (public, full-screen - no header/navbar)
  '/clarify/:issueNumber': { component: Clarify, public: true, fullScreen: true },

  // Bug fix selection page (redirects to /decision/)
  '/bug-fix/:issueNumber': { component: BugFix, public: true, fullScreen: true },

  // Agent decision page (public, full-screen - no header/navbar)
  '/decision/:issueNumber': { component: Decision, public: true, fullScreen: true },

  // Template protected routes
  '/settings': Settings,
  '/theme': Theme,
  '/profile': Profile,
  '/my-requests': MyFeatureRequests,

  // Admin routes
  '/admin/reports': Reports,
  '/admin/feature-requests': FeatureRequests,
  '/admin/feature-requests/:requestId': FeatureRequestDetail,
  '/admin/item/:id': ItemDetail,
  '/admin/workflow': WorkflowItems,

  // Fallback
  '/not-found': NotFound,
};
