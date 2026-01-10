/**
 * Validation mode - run post-sync validation
 */

import { SyncContext } from '../types';
import { log, logError } from '../utils/logging';
import { exec } from '../utils';

/**
 * Run post-sync validation (TypeScript + ESLint)
 * Runs both checks separately to ensure BOTH must pass.
 */
export async function runValidation(context: SyncContext): Promise<boolean> {
  log(context.options, '\n🔍 Running post-sync validation...');

  let tsPass = false;
  let lintPass = false;

  // Run TypeScript check
  log(context.options, '\n📘 Running TypeScript check...');
  try {
    exec('yarn ts', context.projectRoot, { silent: false });
    tsPass = true;
  } catch {
    logError('❌ TypeScript check failed!');
  }

  // Run ESLint check
  log(context.options, '\n📋 Running ESLint check...');
  try {
    exec('yarn lint', context.projectRoot, { silent: false });
    lintPass = true;
  } catch {
    logError('❌ ESLint check failed!');
  }

  // Both must pass
  if (tsPass && lintPass) {
    log(context.options, '✅ Validation passed!');
    return true;
  } else {
    logError('⚠️  Validation failed!');
    logError('   Please review the changes and fix any issues.');
    return false;
  }
}
