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
import { LoginApproval } from './template/LoginApproval';
import { Connection } from './template/Connection';
import { ResetPassword } from './template/ResetPassword';
import { UserApprovals } from './template/UserApprovals';
import { AdminUsers } from './template/AdminUsers';
import { EnrollPasskey } from './template/EnrollPasskey';
import { AdminSessions } from './template/AdminSessions';
import { Admin } from './template/Admin';
import { ServiceWorkerDebug } from './template/ServiceWorkerDebug';
import { MongoExplorer } from './template/MongoExplorer';
import { Routes } from '../features/template/router';

/**
 * Template route definitions.
 * These are universal routes that all projects need.
 * App-specific routes (Home, Todos, etc.) belong in index.project.ts.
 */
export const templateRoutes: Routes = {
  // Login approval page (public, full-screen)
  '/login-approval': { component: LoginApproval, public: true, fullScreen: true },
  '/telegram-login-approval': { component: LoginApproval, public: true, fullScreen: true },

  // Forgot-password reset page (public, full-screen, ?token= from Telegram link)
  '/reset-password': { component: ResetPassword, public: true, fullScreen: true },

  // Passkey enrollment landing (public, full-screen, ?token= from admin/email link)
  '/enroll-passkey': { component: EnrollPasskey, public: true, fullScreen: true },

  // Template protected routes
  '/settings': Settings,
  '/theme': Theme,
  '/profile': Profile,
  '/my-requests': MyFeatureRequests,

  // Admin routes
  '/admin': Admin,
  '/admin/reports': Reports,
  '/admin/feature-requests': FeatureRequests,
  '/admin/feature-requests/:requestId': FeatureRequestDetail,
  '/admin/users': AdminUsers,
  '/admin/approvals': UserApprovals,
  '/admin/sessions': AdminSessions,
  '/admin/service-worker': ServiceWorkerDebug,
  '/admin/mongo-explorer': MongoExplorer,
  '/admin/mongo-explorer/:collectionName': MongoExplorer,
  '/admin/mongo-explorer/:collectionName/:documentKey': MongoExplorer,
  '/admin/rpc-connection': { component: Connection, adminOnly: true },

  // Fallback
  '/not-found': NotFound,
};
