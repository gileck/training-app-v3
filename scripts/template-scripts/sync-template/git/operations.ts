/**
 * Git operations for the Template Sync Tool
 */

import * as fs from 'fs';
import * as path from 'path';
import { SyncContext, TEMPLATE_DIR } from '../types';
import { exec } from '../utils';
import { log, logVerbose } from '../utils/logging';

/**
 * Convert an HTTPS GitHub/GitLab URL to SSH format.
 * Examples:
 *   https://github.com/user/repo.git -> git@github.com:user/repo.git
 *   https://gitlab.com/user/repo.git -> git@gitlab.com:user/repo.git
 */
export function convertToSSH(url: string): string {
  // Already SSH format
  if (url.startsWith('git@')) {
    return url;
  }

  // Match HTTPS URLs like https://github.com/user/repo.git
  const httpsMatch = url.match(/^https?:\/\/([^/]+)\/(.+)$/);
  if (httpsMatch) {
    const [, host, repoPath] = httpsMatch;
    return `git@${host}:${repoPath}`;
  }

  // Return as-is if we can't parse it
  return url;
}

/**
 * Get the repository URL to use for cloning.
 * Uses SSH by default, unless --use-https flag is provided.
 */
export function getRepoUrl(context: SyncContext): string {
  const baseUrl = context.config.templateRepo;

  // If user explicitly wants HTTPS, return as-is
  if (context.options.useHTTPS) {
    return baseUrl;
  }

  // Default: convert to SSH for authentication
  const sshUrl = convertToSSH(baseUrl);
  if (sshUrl !== baseUrl) {
    logVerbose(context.options, `Using SSH URL: ${baseUrl} -> ${sshUrl}`);
  }
  return sshUrl;
}

/**
 * Check if there are uncommitted changes in the project
 */
export function checkGitStatus(context: SyncContext): void {
  const status = exec('git status --porcelain', context.projectRoot, { silent: true });

  if (status && !context.options.force) {
    console.error('❌ Error: You have uncommitted changes.');
    console.error('Please commit or stash your changes before syncing the template.');
    console.error('Or use --force to override this check.');
    process.exit(1);
  }
}

/**
 * Clone the template repository to the temp directory
 */
export function cloneTemplate(context: SyncContext): void {
  const templatePath = path.join(context.projectRoot, TEMPLATE_DIR);

  // Clean up any existing template directory
  if (fs.existsSync(templatePath)) {
    fs.rmSync(templatePath, { recursive: true, force: true });
  }

  const repoUrl = getRepoUrl(context);
  log(context.options, `📥 Cloning template from ${repoUrl}...`);
  // Clone with full history to enable comparison with lastSyncCommit
  exec(
    `git clone --branch ${context.config.templateBranch} ${repoUrl} ${TEMPLATE_DIR}`,
    context.projectRoot,
    { silent: true }
  );
}

/**
 * Clean up the temporary template directory
 */
export function cleanupTemplate(context: SyncContext): void {
  const templatePath = path.join(context.projectRoot, TEMPLATE_DIR);
  if (fs.existsSync(templatePath)) {
    fs.rmSync(templatePath, { recursive: true, force: true });
  }
}

/**
 * Get the current template commit hash
 */
export function getTemplateCommit(context: SyncContext): string {
  const templatePath = path.join(context.projectRoot, TEMPLATE_DIR);
  return exec('git rev-parse HEAD', context.projectRoot, {
    cwd: templatePath,
    silent: true,
  });
}
