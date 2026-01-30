/**
 * Changelog mode - show template commits since last sync
 */

import * as path from 'path';
import { SyncContext, TEMPLATE_DIR } from '../types';
import { log } from '../utils/logging';
import { exec } from '../utils';
import { cloneTemplate, cleanupTemplate } from '../git';
import { displayTotalDiffSummary } from '../ui';
import { getTemplateCommitsSinceLastSync } from '../reporting';

/**
 * Run changelog mode - show template commits since last sync
 */
export async function runChangelog(context: SyncContext): Promise<void> {
  log(context.options, '📜 Template Changelog');
  log(context.options, '='.repeat(60));

  // Clone template to get commits
  cloneTemplate(context);

  try {
    const templatePath = path.join(context.projectRoot, TEMPLATE_DIR);
    const templateCommit = exec('git rev-parse HEAD', context.projectRoot, {
      cwd: templatePath,
      silent: true,
    });

    log(context.options, `\n📍 Current template: ${templateCommit}`);

    if (context.config.lastSyncCommit) {
      log(context.options, `📍 Last synced:      ${context.config.lastSyncCommit}`);
      log(context.options, `📅 Last sync date:   ${context.config.lastSyncDate || 'unknown'}`);
    } else {
      log(context.options, '📍 Last synced:      (never synced)');
    }

    // Show total diff summary
    displayTotalDiffSummary(context);

    const commits = getTemplateCommitsSinceLastSync(context);

    if (commits.length === 0) {
      log(context.options, '\n✅ No new commits since last sync.');
    } else {
      log(context.options, `\n📝 New commits since last sync (${commits.length}):\n`);
      commits.forEach((c) => {
        // Only show the first line (headline with date)
        const headline = c.split('\n')[0];
        log(context.options, `   ${headline}`);
      });
    }

    log(context.options, '\n' + '='.repeat(60));
  } finally {
    cleanupTemplate(context);
  }
}
