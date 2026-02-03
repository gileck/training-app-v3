/**
 * Global Dialogs
 *
 * This file combines template dialogs with project-specific dialogs.
 * Template dialogs are in GlobalDialogs.template.tsx (synced from template).
 *
 * Add your project-specific dialogs below the TemplateDialogs component.
 */

import { TemplateDialogs } from './template/GlobalDialogs.template';

export const GlobalDialogs = () => (
  <>
    <TemplateDialogs />
    {/* Add project-specific dialogs below: */}
    {/* <MyCustomDialog /> */}
  </>
);
