/**
 * Show drift mode - show total project drift with full file list
 */

import * as path from 'path';
import { SyncContext, TEMPLATE_DIR } from '../types';
import { log } from '../utils/logging';
import { exec } from '../utils';
import { cloneTemplate, cleanupTemplate } from '../git';
import { displayTotalDiffSummary, displayTotalDiffDetails } from '../ui';

/**
 * Run show-drift mode - show total project drift with full file list
 */
export async function runShowDrift(context: SyncContext): Promise<void> {
  log(context.options, '📊 Total Project Drift');
  log(context.options, '='.repeat(60));

  // Clone template to compare
  cloneTemplate(context);

  try {
    const templatePath = path.join(context.projectRoot, TEMPLATE_DIR);
    const templateCommit = exec('git rev-parse HEAD', context.projectRoot, {
      cwd: templatePath,
      silent: true,
    });

    log(context.options, `\n📍 Template commit: ${templateCommit}`);

    if (context.config.lastSyncCommit) {
      log(context.options, `📍 Last synced:     ${context.config.lastSyncCommit}`);
      log(context.options, `📅 Last sync date:  ${context.config.lastSyncDate || 'unknown'}`);
    } else {
      log(context.options, '📍 Last synced:     (never synced)');
    }

    // Show total diff summary
    displayTotalDiffSummary(context);

    // Show full details
    displayTotalDiffDetails(context.totalDiffSummary);

    log(context.options, '\n💡 Run "yarn sync-template" to sync changes from template.');
  } finally {
    cleanupTemplate(context);
  }
}
