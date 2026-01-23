/**
 * Route Definitions
 *
 * This file defines the app's routes by merging template routes with project routes.
 * Template routes are in index.template.ts (synced from template).
 *
 * Add your project-specific routes below.
 */

import { createRoutes } from '../router';
import { templateRoutes } from './index.template';
import { Home } from './Home';
import { AIChat } from './AIChat';
import { TrainingPlans } from './TrainingPlans';
import { ManagePlan } from './ManagePlan';
import { Progress } from './Progress';
import { ActiveWorkout } from './ActiveWorkout';
import { SharedPlan } from './SharedPlan';

export const routes = createRoutes({
  // Template routes (settings, profile, admin, theme, not-found, my-requests, etc.)
  ...templateRoutes,

  // Project routes (Training App):
  '/': Home,
  '/training-plans': TrainingPlans,
  '/training-plans/:planId': ManagePlan,
  '/active-workout': ActiveWorkout,
  '/progress': Progress,
  '/ai-chat': AIChat,
  '/share/:token': { component: SharedPlan, public: true },

  // Add more project routes here:
  // '/my-page': MyPage,
});
