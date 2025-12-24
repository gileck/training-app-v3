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
  baseCommit: string | null;
  lastSyncCommit: string | null;
  lastProjectCommit: string | null;
  lastSyncDate: string | null;
  ignoredFiles: string[];
  projectSpecificFiles: string[];
}

const CONFIG_FILE = '.template-sync.json';

const DEFAULT_IGNORED_FILES = [
  '.template-sync.json',
  'package.json',
  'README.md',
  '.env',
  '.env.local',
  '.gitignore',
  '.git',
  'node_modules',
  'dist',
  'build',
  '.cursor',
  'yarn.lock',
  'package-lock.json',
  'pnpm-lock.yaml',
  // Project-specific config
  'src/app.config.js',                       // App name, db name, etc.
  // Example features (not needed in new projects)
  'src/client/routes/Todos/**',
  'src/client/routes/Chat/**',
  'src/client/routes/AIChat/**',
  'src/client/routes/SingleTodo/**',
  'src/client/routes/Home/**',
  'src/pages/index.tsx',  // Home page (users customize)
  'src/apis/todos/**',
  'src/apis/chat/**',
  'src/client/features/todos/**',
  'src/client/features/chat/**',
  // User-specific registry/index files (users customize these)
  'src/client/routes/index.ts',           // Route registrations
  'src/client/components/NavLinks.tsx',    // Navigation menu items
  'src/apis/apis.ts',                      // API handler registrations
  'src/server/database/collections/index.ts', // Collection exports
  'src/server/database/collections/todos',    // Example collection
  'src/server/database/collections/reports',  // Example collection
];

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

  // Validate template repo
  console.log(`📦 Template repository: ${finalRepo}`);

  // Try to get current git commit (for baseCommit)
  const currentCommit = exec('git rev-parse HEAD');

  // Create config
  // Note: lastSyncCommit is null for first sync - this tells sync-template
  // to compare the entire template against the project
  const config: TemplateSyncConfig = {
    templateRepo: finalRepo,
    templateBranch: 'main',
    baseCommit: currentCommit || null,  // Project commit when initialized
    lastSyncCommit: null,               // null = first sync, will compare everything
    lastProjectCommit: currentCommit || null,
    lastSyncDate: null,
    ignoredFiles: DEFAULT_IGNORED_FILES,
    projectSpecificFiles: [],
  };

  // Save config
  fs.writeFileSync(
    configPath,
    JSON.stringify(config, null, 2) + '\n',
    'utf-8'
  );

  console.log('\n✅ Template tracking initialized!');
  console.log(`   Config saved to: ${CONFIG_FILE}`);
  console.log(`\n💡 Next steps:`);
  console.log(`   1. Review and customize ${CONFIG_FILE}`);
  console.log(`   2. Add project-specific files to "projectSpecificFiles" array`);
  console.log(`   3. Run "yarn sync-template" to sync with template updates`);
  console.log(`\n📚 Usage:`);
  console.log(`   yarn sync-template          # Sync with template`);
  console.log(`   yarn sync-template --dry-run # Preview changes`);
}

// Main execution
const args = process.argv.slice(2);

// Parse flags
const useHTTPS = args.includes('--use-https');
const positionalArgs = args.filter(arg => !arg.startsWith('--'));

if (positionalArgs.length === 0) {
  console.error('❌ Error: Template repository URL required\n');
  console.error('Usage:');
  console.error('  yarn init-template <template-repo-url> [options]');
  console.error('\nOptions:');
  console.error('  --use-https  Store the HTTPS URL instead of SSH (SSH is default)');
  console.error('\nExample:');
  console.error('  yarn init-template https://github.com/yourusername/app-template-ai.git');
  console.error('  yarn init-template https://github.com/yourusername/app-template-ai.git --use-https');
  process.exit(1);
}

const templateRepo = positionalArgs[0];
initTemplate(templateRepo, useHTTPS);

