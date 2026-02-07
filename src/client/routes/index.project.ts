/**
 * Project-Specific Routes
 *
 * Add your project-specific route definitions here.
 * This file is NOT synced from template - it's owned by your project.
 */

import type { Routes } from '../router';
import { Home } from './project/Home';
import { TrainingPlans } from './project/TrainingPlans';
import { ManagePlan } from './project/ManagePlan';
import { Progress } from './project/Progress';
import { ActiveWorkout } from './project/ActiveWorkout';
import { SharedPlan } from './project/SharedPlan';

export const projectRoutes: Routes = {
  // Training App routes:
  '/': Home,
  '/training-plans': TrainingPlans,
  '/training-plans/:planId': ManagePlan,
  '/active-workout': ActiveWorkout,
  '/progress': Progress,
  '/share/:token': { component: SharedPlan, public: true },
};
