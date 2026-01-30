#!/usr/bin/env tsx

/**
 * Cleanup Old Folder Structure
 *
 * This script removes old folder locations after migrating to the new
 * template folder structure (Jan 2026).
 *
 * Old structure:
 *   - scripts/template-scripts/  → scripts/template/
 *   - .ai/skills/*               → .ai/skills/template/*
 *   - docs/*.md                  → docs/template/*.md
 *
 * Usage:
 *   yarn cleanup-old-folders           # Interactive mode
 *   yarn cleanup-old-folders --force   # Skip confirmation
 *   yarn cleanup-old-folders --dry-run # Preview only
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const projectRoot = process.cwd();
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');

// Old folders/files to remove
const OLD_FOLDERS = [
  'scripts/template-scripts',
];

// Old skill folders (at .ai/skills/ root, not in template/ or project/)
const OLD_SKILL_FOLDERS = [
  'ai-models-api-usage',
  'app-guidelines-checklist',
  'client-server-communications',
  'contribute-to-template',
  'debug-bug-report',
  'eslint-custom-guidelines',
  'feature-based-structure',
  'feature-planning',
  'full-project-audit',
  'mongodb-usage',
  'pages-and-routing-guidelines',
  'react-component-organization',
  'react-hook-organization',
  'settings-usage-guidelines',
  'shadcn-usage',
  'state-management-guidelines',
  'sync-template',
  'template-diff',
  'theming-guidelines',
  'typescript-guidelines',
  'ui-design-guidelines',
  'ui-mobile-first-shadcn',
  'user-access',
  'vercel-cli-usage',
  'vercel-composition-patterns',
  'vercel-react-best-practices',
  'web-design-guidelines',
];

// Old doc files at docs/ root (not in template/ or project/)
const OLD_DOC_FILES = [
  'admin.md',
  'agent-library-abstraction.md',
  'agent-library-gemini.md',
  'agent-library-openai-codex.md',
  'api-endpoint-format.md',
  'architecture.md',
  'authentication.md',
  'caching-strategy.md',
  'critical-deployment-issues.md',
  'eslint-typescript-wixpress-issue.md',
  'exit-codes-guide.md',
  'git-worktree-workflow.md',
  'github-pr-cli-guide.md',
  'init-github-projects-workflow.md',
  'ios-pwa-fixes.md',
  'logging-and-error-tracking.md',
  'mongodb-usage.md',
  'offline-pwa-support.md',
  'react-query-mutations.md',
  'react-rendering-guidelines.md',
  'shadcn-component-library.md',
  'state-management.md',
  'telegram-notifications.md',
  'theming.md',
  'validation-planning-mode.md',
  'vercel-cli-guide.md',
  'wixpress-registry-issues.md',
  'zustand-stores.md',
];

// Old doc folders at docs/ root
const OLD_DOC_FOLDERS = [
  'github-agents-workflow',
  'template-sync',
];

interface CleanupItem {
  path: string;
  type: 'folder' | 'file';
  exists: boolean;
}

function findItemsToClean(): CleanupItem[] {
  const items: CleanupItem[] = [];

  // Check old folders
  for (const folder of OLD_FOLDERS) {
    const fullPath = path.join(projectRoot, folder);
    items.push({
      path: folder,
      type: 'folder',
      exists: fs.existsSync(fullPath),
    });
  }

  // Check old skill folders
  for (const skill of OLD_SKILL_FOLDERS) {
    const fullPath = path.join(projectRoot, '.ai/skills', skill);
    items.push({
      path: `.ai/skills/${skill}`,
      type: 'folder',
      exists: fs.existsSync(fullPath),
    });
  }

  // Check old doc files
  for (const doc of OLD_DOC_FILES) {
    const fullPath = path.join(projectRoot, 'docs', doc);
    items.push({
      path: `docs/${doc}`,
      type: 'file',
      exists: fs.existsSync(fullPath),
    });
  }

  // Check old doc folders
  for (const folder of OLD_DOC_FOLDERS) {
    const fullPath = path.join(projectRoot, 'docs', folder);
    // Only mark for deletion if it exists AND docs/template/{folder} also exists
    const newPath = path.join(projectRoot, 'docs/template', folder);
    const existsOld = fs.existsSync(fullPath);
    const existsNew = fs.existsSync(newPath);

    if (existsOld && existsNew) {
      items.push({
        path: `docs/${folder}`,
        type: 'folder',
        exists: true,
      });
    }
  }

  return items;
}

function deleteItem(item: CleanupItem): void {
  const fullPath = path.join(projectRoot, item.path);

  if (item.type === 'folder') {
    fs.rmSync(fullPath, { recursive: true, force: true });
  } else {
    fs.unlinkSync(fullPath);
  }
}

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function main() {
  console.log('🧹 Cleanup Old Folder Structure');
  console.log('='.repeat(60));

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Check if new structure exists
  const hasNewStructure = fs.existsSync(path.join(projectRoot, 'scripts/template'));
  if (!hasNewStructure) {
    console.log('❌ New folder structure not found (scripts/template/).');
    console.log('   Run "yarn sync-template" first to get the new structure.');
    process.exit(1);
  }

  // Find items to clean
  const items = findItemsToClean();
  const existingItems = items.filter(i => i.exists);

  if (existingItems.length === 0) {
    console.log('✅ No old folders/files found. Already cleaned up!');
    process.exit(0);
  }

  // Display what will be removed
  console.log(`\n📋 Found ${existingItems.length} items to remove:\n`);

  const folders = existingItems.filter(i => i.type === 'folder');
  const files = existingItems.filter(i => i.type === 'file');

  if (folders.length > 0) {
    console.log(`📁 Folders (${folders.length}):`);
    for (const item of folders) {
      console.log(`   • ${item.path}/`);
    }
  }

  if (files.length > 0) {
    console.log(`\n📄 Files (${files.length}):`);
    for (const item of files) {
      console.log(`   • ${item.path}`);
    }
  }

  if (dryRun) {
    console.log('\n🔍 DRY RUN - No changes made.');
    process.exit(0);
  }

  // Confirm deletion
  if (!force) {
    console.log('');
    const confirmed = await confirm('Delete these items?');
    if (!confirmed) {
      console.log('❌ Cancelled.');
      process.exit(0);
    }
  }

  // Delete items
  console.log('\n🗑️  Deleting...\n');

  let deleted = 0;
  let errors = 0;

  for (const item of existingItems) {
    try {
      deleteItem(item);
      console.log(`   ✓ ${item.path}`);
      deleted++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`   ✗ ${item.path}: ${message}`);
      errors++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log(`   ✅ Deleted: ${deleted}`);
  if (errors > 0) {
    console.log(`   ❌ Errors: ${errors}`);
  }

  console.log('\n💡 Next steps:');
  console.log('   1. Run "yarn checks" to verify everything works');
  console.log('   2. Commit the cleanup:');
  console.log('      git add -A');
  console.log('      git commit -m "chore: cleanup old folder structure"');
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
