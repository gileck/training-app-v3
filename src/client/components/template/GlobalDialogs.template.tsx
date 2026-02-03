/**
 * Template Global Dialogs
 *
 * These are global dialogs provided by the template.
 * Do not modify this file - it will be overwritten during template sync.
 *
 * To add project-specific dialogs, add them to GlobalDialogs.tsx instead.
 */

import { BugReportDialog, FeatureRequestDialog } from '@/client/features';

export const TemplateDialogs = () => (
  <>
    <BugReportDialog />
    <FeatureRequestDialog />
  </>
);
