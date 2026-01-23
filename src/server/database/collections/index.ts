/**
 * Database Collections
 *
 * This file re-exports template collections and adds project-specific collections.
 * Template collections are in index.template.ts (synced from template).
 *
 * Add your project-specific collection exports below the template re-export.
 */

// Re-export all template collections (users, reports, featureRequests)
export * from './index.template';

// Project-specific collections (Training App):
export * as todos from './todos';
export * as trainingPlans from './trainingPlans';
export * as exerciseDefinitions from './exerciseDefinitions';
export * as planExercises from './planExercises';
export * as weeklyProgress from './weeklyProgress';
export * as exerciseProgress from './exerciseProgress';
export * as setLogs from './setLogs';
export * as planWorkouts from './planWorkouts';
export * as weeklyNotes from './weeklyNotes';
