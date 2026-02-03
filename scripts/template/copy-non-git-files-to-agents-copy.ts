#!/usr/bin/env tsx
/**
 * Copy non-git-tracked files to the agents-copy project
 *
 * Copies .env.local, yarn.lock, and node_modules to keep the agents-copy in sync
 * with the main project's environment and dependencies.
 *
 * Usage:
 *   yarn copy-to-agents
 */

import { existsSync, copyFileSync, rmSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, basename } from 'path';
import { homedir } from 'os';

const FILES_TO_COPY = ['.env.local', 'yarn.lock'];
const DIRS_TO_COPY = ['node_modules'];

function main() {
  const currentDir = process.cwd();
  const repoName = basename(currentDir);
  const defaultAgentsCopyLocation = resolve(homedir(), 'Projects', 'agents-copy', repoName);

  // Allow override via command line argument
  const targetLocation = process.argv[2] || defaultAgentsCopyLocation;

  console.log('📦 Copy Non-Git Files to Agents Copy');
  console.log('='.repeat(50));
  console.log();
  console.log(`Source: ${currentDir}`);
  console.log(`Target: ${targetLocation}`);
  console.log();

  if (!existsSync(targetLocation)) {
    console.error(`❌ Agents copy not found at: ${targetLocation}`);
    console.error('   Run "yarn init-agents-copy" first to create it.');
    process.exit(1);
  }

  let copiedCount = 0;
  let skippedCount = 0;

  // Copy files
  for (const file of FILES_TO_COPY) {
    const sourcePath = resolve(currentDir, file);
    const targetPath = resolve(targetLocation, file);

    if (!existsSync(sourcePath)) {
      console.log(`⚠️  ${file} - not found in source, skipping`);
      skippedCount++;
      continue;
    }

    try {
      copyFileSync(sourcePath, targetPath);
      console.log(`✅ ${file} - copied`);
      copiedCount++;
    } catch (error) {
      console.error(`❌ ${file} - failed to copy:`, error);
      process.exit(1);
    }
  }

  // Copy directories (delete target first, then copy)
  for (const dir of DIRS_TO_COPY) {
    const sourcePath = resolve(currentDir, dir);
    const targetPath = resolve(targetLocation, dir);

    if (!existsSync(sourcePath)) {
      console.log(`⚠️  ${dir}/ - not found in source, skipping`);
      skippedCount++;
      continue;
    }

    try {
      console.log(`🗑️  ${dir}/ - removing from target...`);
      if (existsSync(targetPath)) {
        rmSync(targetPath, { recursive: true, force: true });
      }
      console.log(`📁 ${dir}/ - copying with symlinks preserved (this may take a moment)...`);
      // Use cp -a to preserve symlinks (cpSync follows symlinks and breaks .bin/)
      execSync(`cp -a "${sourcePath}" "${targetPath}"`, { stdio: 'inherit' });
      console.log(`✅ ${dir}/ - copied`);
      copiedCount++;
    } catch (error) {
      console.error(`❌ ${dir}/ - failed to copy:`, error);
      process.exit(1);
    }
  }

  console.log();
  console.log('='.repeat(50));
  console.log(`✅ Done! Copied ${copiedCount} item(s), skipped ${skippedCount}`);
}

main();
