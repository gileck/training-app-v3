/**
 * Project-Specific Routes
 *
 * Add your project-specific route definitions here.
 * This file is NOT synced from template - it's owned by your project.
 */

import type { Routes } from '../router';
import { Home } from './Home';
import { AIChat } from './AIChat';
import { TrainingPlans } from './TrainingPlans';
import { ManagePlan } from './ManagePlan';
import { Progress } from './Progress';
import { ActiveWorkout } from './ActiveWorkout';
import { SharedPlan } from './SharedPlan';

export const projectRoutes: Routes = {
  // Training App routes:
  '/': Home,
  '/training-plans': TrainingPlans,
  '/training-plans/:planId': ManagePlan,
  '/active-workout': ActiveWorkout,
  '/progress': Progress,
  '/ai-chat': AIChat,
  '/share/:token': { component: SharedPlan, public: true },
};
