#!/usr/bin/env tsx
/**
 * Sync Child Projects Script
 *
 * Syncs all child projects (cloned from this template) with safe changes.
 * Only syncs projects that have no uncommitted changes.
 *
 * Usage:
 *   yarn sync-children           # Sync all child projects
 *   yarn sync-children --dry-run # Preview what would be synced
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface ChildProjectsConfig {
  projects: string[];
}

interface SyncResult {
  project: string;
  status: 'synced' | 'skipped' | 'error' | 'not-found';
  message: string;
}

const CONFIG_FILE = 'child-projects.json';

function loadConfig(templateRoot: string): ChildProjectsConfig | null {
  const configPath = path.join(templateRoot, CONFIG_FILE);

  if (!fs.existsSync(configPath)) {
    console.error(`\n❌ Config file not found: ${configPath}`);
    console.error(`\nCreate ${CONFIG_FILE} with the following format:`);
    console.error(`{
  "projects": [
    "../project-1",
    "../project-2"
  ]
}`);
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as ChildProjectsConfig;
  } catch (error) {
    console.error(`\n❌ Failed to parse ${CONFIG_FILE}:`, error);
    return null;
  }
}

function hasUncommittedChanges(projectPath: string): boolean {
  try {
    const status = execSync('git status --porcelain', {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return status.trim().length > 0;
  } catch {
    return true; // If we can't check, assume there are changes
  }
}

function isGitRepo(projectPath: string): boolean {
  try {
    execSync('git rev-parse --git-dir', {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

function syncProject(projectPath: string, dryRun: boolean): SyncResult {
  const projectName = path.basename(projectPath);

  // Check if project directory exists
  if (!fs.existsSync(projectPath)) {
    return {
      project: projectName,
      status: 'not-found',
      message: `Directory not found: ${projectPath}`,
    };
  }

  // Check if it's a git repository
  if (!isGitRepo(projectPath)) {
    return {
      project: projectName,
      status: 'error',
      message: 'Not a git repository',
    };
  }

  // Check for uncommitted changes
  if (hasUncommittedChanges(projectPath)) {
    return {
      project: projectName,
      status: 'skipped',
      message: 'Has uncommitted changes',
    };
  }

  // Run sync-template
  try {
    const flags = dryRun ? '--dry-run --quiet' : '--auto-safe-only --quiet';
    const command = `yarn sync-template ${flags}`;

    console.log(`\n📦 Syncing ${projectName}...`);

    const output = execSync(command, {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Check if there were any changes synced
    const hasChanges = output.includes('✅ Template sync completed') ||
                       output.includes('Committed as');
    const noChanges = output.includes('No changes detected') ||
                      output.includes('Nothing to sync');

    if (noChanges) {
      return {
        project: projectName,
        status: 'synced',
        message: 'Already up to date',
      };
    }

    if (hasChanges) {
      return {
        project: projectName,
        status: 'synced',
        message: dryRun ? 'Changes available (dry run)' : 'Changes synced and committed',
      };
    }

    return {
      project: projectName,
      status: 'synced',
      message: dryRun ? 'Checked (dry run)' : 'Sync completed',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for specific known messages
    if (errorMessage.includes('No changes detected') ||
        errorMessage.includes('Nothing to sync')) {
      return {
        project: projectName,
        status: 'synced',
        message: 'Already up to date',
      };
    }

    return {
      project: projectName,
      status: 'error',
      message: errorMessage.split('\n')[0].substring(0, 80),
    };
  }
}

function printSummary(results: SyncResult[]): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 SYNC SUMMARY');
  console.log('='.repeat(60));

  const synced = results.filter(r => r.status === 'synced');
  const skipped = results.filter(r => r.status === 'skipped');
  const errors = results.filter(r => r.status === 'error');
  const notFound = results.filter(r => r.status === 'not-found');

  if (synced.length > 0) {
    console.log(`\n✅ Synced (${synced.length}):`);
    synced.forEach(r => console.log(`   • ${r.project}: ${r.message}`));
  }

  if (skipped.length > 0) {
    console.log(`\n⏭️  Skipped (${skipped.length}):`);
    skipped.forEach(r => console.log(`   • ${r.project}: ${r.message}`));
  }

  if (notFound.length > 0) {
    console.log(`\n⚠️  Not Found (${notFound.length}):`);
    notFound.forEach(r => console.log(`   • ${r.project}: ${r.message}`));
  }

  if (errors.length > 0) {
    console.log(`\n❌ Errors (${errors.length}):`);
    errors.forEach(r => console.log(`   • ${r.project}: ${r.message}`));
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Total: ${results.length} projects | Synced: ${synced.length} | Skipped: ${skipped.length} | Errors: ${errors.length + notFound.length}`);
  console.log('='.repeat(60) + '\n');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('🔄 Sync Child Projects');
  console.log('='.repeat(60));

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be applied\n');
  }

  const templateRoot = process.cwd();
  const config = loadConfig(templateRoot);

  if (!config) {
    process.exit(1);
  }

  if (config.projects.length === 0) {
    console.log('No projects configured in child-projects.json');
    process.exit(0);
  }

  console.log(`Found ${config.projects.length} child project(s) to sync:\n`);
  config.projects.forEach(p => console.log(`   • ${p}`));

  const results: SyncResult[] = [];

  for (const relativePath of config.projects) {
    const projectPath = path.resolve(templateRoot, relativePath);
    const result = syncProject(projectPath, dryRun);
    results.push(result);
  }

  printSummary(results);

  // Exit with error code if any projects failed
  const hasErrors = results.some(r => r.status === 'error');
  if (hasErrors) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
