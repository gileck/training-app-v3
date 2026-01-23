#!/usr/bin/env tsx
/**
 * Initialize a separate copy of the project for running agents
 *
 * This creates a clean clone of the repository in a separate directory
 * to avoid conflicts between development work and agent operations.
 *
 * Usage:
 *   yarn init-agents-copy
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { resolve, basename } from 'path';
import { homedir } from 'os';
import readline from 'readline';

// ============================================================================
// Utilities
// ============================================================================

function exec(command: string, cwd?: string): string {
  try {
    return execSync(command, {
      cwd: cwd || process.cwd(),
      encoding: 'utf-8',
      stdio: ['inherit', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    if (error instanceof Error && 'stdout' in error) {
      return (error as { stdout: Buffer }).stdout.toString().trim();
    }
    throw error;
  }
}

function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const promptText = defaultValue
      ? `${question} (default: ${defaultValue}): `
      : `${question}: `;

    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

// ============================================================================
// Main Script
// ============================================================================

async function main() {
  console.log('🤖 Initialize Agents Copy Project');
  console.log('='.repeat(60));
  console.log();

  // Get current project info
  const currentDir = process.cwd();
  const repoName = basename(currentDir);

  // Get remote URL
  let remoteUrl: string;
  try {
    remoteUrl = exec('git config --get remote.origin.url');
  } catch {
    console.error('❌ Error: Not in a git repository');
    process.exit(1);
  }

  console.log(`📦 Current project: ${repoName}`);
  console.log(`🔗 Remote: ${remoteUrl}`);
  console.log();

  // Default location
  const defaultLocation = resolve(homedir(), 'Projects', 'agents-copy', repoName);

  // Prompt for location
  const targetLocation = await prompt(
    '📁 Where should the agents copy be created?',
    defaultLocation
  );

  if (!targetLocation) {
    console.error('❌ Error: No location provided');
    process.exit(1);
  }

  const resolvedLocation = resolve(targetLocation.replace('~', homedir()));

  // Check if location already exists
  if (existsSync(resolvedLocation)) {
    const overwrite = await prompt(
      `⚠️  Directory already exists: ${resolvedLocation}\n   Overwrite? (yes/no)`,
      'no'
    );

    if (overwrite.toLowerCase() !== 'yes') {
      console.log('❌ Aborted');
      process.exit(0);
    }

    console.log(`🗑️  Removing existing directory...`);
    exec(`rm -rf "${resolvedLocation}"`);
  }

  // Create parent directory if needed
  const parentDir = resolve(resolvedLocation, '..');
  if (!existsSync(parentDir)) {
    console.log(`📁 Creating parent directory: ${parentDir}`);
    mkdirSync(parentDir, { recursive: true });
  }

  console.log();
  console.log('⏳ Cloning repository...');
  console.log(`   From: ${remoteUrl}`);
  console.log(`   To:   ${resolvedLocation}`);
  console.log();

  // Clone the repository
  try {
    exec(`git clone "${remoteUrl}" "${resolvedLocation}"`);
    console.log('✅ Repository cloned successfully');
  } catch (error) {
    console.error('❌ Error cloning repository:', error);
    process.exit(1);
  }

  console.log();
  console.log('📦 Installing dependencies...');
  try {
    exec('yarn install', resolvedLocation);
    console.log('✅ Dependencies installed successfully');
  } catch (error) {
    console.error('❌ Error installing dependencies:', error);
    process.exit(1);
  }

  // Copy .env.local if it exists
  const envLocalSource = resolve(currentDir, '.env.local');
  const envLocalTarget = resolve(resolvedLocation, '.env.local');

  console.log();
  if (existsSync(envLocalSource)) {
    console.log('📄 Copying .env.local...');
    try {
      copyFileSync(envLocalSource, envLocalTarget);
      console.log('✅ .env.local copied successfully');
    } catch (error) {
      console.error('⚠️  Warning: Could not copy .env.local:', error);
      console.log('   You may need to create it manually');
    }
  } else {
    console.log('⚠️  Warning: .env.local not found in current directory');
    console.log('   You may need to create it manually in the agents copy');
  }

  console.log();
  console.log('='.repeat(60));
  console.log('✅ Agents copy project is ready!');
  console.log();
  console.log('📍 Location:');
  console.log(`   ${resolvedLocation}`);
  console.log();
  console.log('🚀 To use it:');
  console.log(`   cd "${resolvedLocation}"`);
  console.log('   yarn agent:product-design --all');
  console.log('   yarn agent:tech-design --all');
  console.log('   yarn agent:implement --all');
  console.log();
  console.log('💡 Tip: Keep this copy for agent operations only.');
  console.log('   Continue development in your original repository.');
  console.log();
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
