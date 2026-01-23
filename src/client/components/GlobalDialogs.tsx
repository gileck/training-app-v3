/**
 * Global Dialogs
 *
 * This file combines template dialogs with project-specific dialogs.
 * Template dialogs are in GlobalDialogs.template.tsx (synced from template).
 *
 * Add your project-specific dialogs/overlays below the TemplateDialogs component.
 */

import { TemplateDialogs } from './GlobalDialogs.template';
import { FloatingWorkoutBar } from './layout/FloatingWorkoutBar';

export const GlobalDialogs = () => (
  <>
    <TemplateDialogs />
    {/* Project-specific dialogs/overlays: */}
    <FloatingWorkoutBar />
  </>
);
