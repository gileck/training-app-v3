import { Home } from './Home';
import { NotFound } from './NotFound';
import { AIChat } from './AIChat';
import { Settings } from './Settings';
import { createRoutes } from '../router';
import { Profile } from './Profile';
import { Reports } from './Reports';
import { TrainingPlans } from './TrainingPlans';
import { ManagePlan } from './ManagePlan';
import { Progress } from './Progress';
import { Theme } from './Theme';
import { ActiveWorkout } from './ActiveWorkout';
import { SharedPlan } from './SharedPlan';

// Define routes
export const routes = createRoutes({
  '/': Home,
  '/training-plans': TrainingPlans,
  '/training-plans/:planId': ManagePlan,
  '/active-workout': ActiveWorkout,
  '/progress': Progress,
  '/ai-chat': AIChat,
  '/settings': Settings,
  '/theme': Theme,
  '/not-found': NotFound,
  '/profile': Profile,
  '/admin/reports': Reports,
  '/share/:token': SharedPlan,
});
