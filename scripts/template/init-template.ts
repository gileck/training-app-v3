#!/usr/bin/env tsx

/**
 * Initialize Template Tracking
 * 
 * This script initializes a new project to track updates from the template.
 * Run this once when you first create a project from the template.
 * 
 * Usage:
 *   yarn init-template <template-repo-url> [options]
 * 
 * Options:
 *   --use-https  Store the HTTPS URL instead of SSH (SSH is default)
 * 
 * Example:
 *   yarn init-template https://github.com/yourusername/app-template-ai.git
 *   yarn init-template https://github.com/yourusername/app-template-ai.git --use-https
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface TemplateSyncConfig {
  templateRepo: string;
  templateBranch: string;
  templateLocalPath: string | null;  // Local path to template repo (for faster sync; matches existing child projects)
  lastSyncCommit: string | null;
  lastSyncDate: string | null;
  projectOverrides: string[];
}

const CONFIG_FILE = '.template-sync.json';

// Default template repo URL — new child projects sync from here unless overridden.
const DEFAULT_TEMPLATE_REPO = 'git@github.com:gileck/app-template-ai.git';

// Default local path sibling to the child project — allows offline/local syncs.
const DEFAULT_TEMPLATE_LOCAL_PATH = '../app-template-ai';

function exec(command: string, silent = true): string {
  try {
    return execSync(command, {
      encoding: 'utf-8',
      stdio: silent ? 'pipe' : 'inherit',
    }).toString().trim();
  } catch (error: any) {
    if (!silent) throw error;
    return '';
  }
}

/**
 * Convert an HTTPS GitHub/GitLab URL to SSH format.
 * Examples:
 *   https://github.com/user/repo.git -> git@github.com:user/repo.git
 *   https://gitlab.com/user/repo.git -> git@gitlab.com:user/repo.git
 */
function convertToSSH(url: string): string {
  // Already SSH format
  if (url.startsWith('git@')) {
    return url;
  }

  // Match HTTPS URLs like https://github.com/user/repo.git
  const httpsMatch = url.match(/^https?:\/\/([^/]+)\/(.+)$/);
  if (httpsMatch) {
    const [, host, path] = httpsMatch;
    return `git@${host}:${path}`;
  }

  // Return as-is if we can't parse it
  return url;
}

function initTemplate(templateRepo: string, useHTTPS: boolean): void {
  const projectRoot = process.cwd();
  const configPath = path.join(projectRoot, CONFIG_FILE);

  console.log('🚀 Initializing template tracking...\n');

  // Check if already initialized
  if (fs.existsSync(configPath)) {
    console.log('⚠️  Template tracking is already initialized.');
    console.log(`   Config file: ${configPath}`);

    const response = exec('read -p "Do you want to reinitialize? (y/N): " answer; echo $answer');
    if (response.toLowerCase() !== 'y') {
      console.log('❌ Aborted.');
      process.exit(0);
    }
  }

  // Convert to SSH by default (unless --use-https is specified)
  let finalRepo = templateRepo;
  if (!useHTTPS) {
    finalRepo = convertToSSH(templateRepo);
    if (finalRepo !== templateRepo) {
      console.log(`🔐 Using SSH URL: ${finalRepo}`);
    }
  }

  console.log(`📦 Template repository: ${finalRepo}`);
  console.log(`📁 Template local path: ${DEFAULT_TEMPLATE_LOCAL_PATH}`);

  // Create config — schema matches ProjectOwnedConfig used by sync-template.
  // lastSyncCommit is null on first sync so the tool compares the entire template.
  const config: TemplateSyncConfig = {
    templateRepo: finalRepo,
    templateBranch: 'main',
    templateLocalPath: DEFAULT_TEMPLATE_LOCAL_PATH,
    lastSyncCommit: null,
    lastSyncDate: null,
    projectOverrides: [],
  };

  fs.writeFileSync(
    configPath,
    JSON.stringify(config, null, 2) + '\n',
    'utf-8'
  );

  console.log('\n✅ Template tracking initialized!');
  console.log(`   Config saved to: ${CONFIG_FILE}`);
  console.log(`\n📚 Usage:`);
  console.log(`   yarn sync-template          # Sync with template`);
  console.log(`   yarn sync-template --dry-run # Preview changes`);
}

// Main execution
const args = process.argv.slice(2);

// Parse flags
const useHTTPS = args.includes('--use-https');
const positionalArgs = args.filter(arg => !arg.startsWith('--'));

// Template repo URL is optional — defaults to the canonical template when omitted.
const templateRepo = positionalArgs[0] || DEFAULT_TEMPLATE_REPO;
initTemplate(templateRepo, useHTTPS);

