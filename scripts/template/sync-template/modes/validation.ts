/**
 * Validation mode - run post-sync validation
 */

import { execSync } from 'child_process';
import { SyncContext } from '../types';
import { log, logError } from '../utils/logging';
import { exec } from '../utils';

/**
 * Result of validation checks with captured errors
 */
export interface ValidationResult {
  passed: boolean;
  tsPass: boolean;
  lintPass: boolean;
  tsErrors: string[];
  lintErrors: string[];
}

/**
 * Run post-sync validation (TypeScript + ESLint)
 * Runs both checks separately to ensure BOTH must pass.
 */
export async function runValidation(context: SyncContext): Promise<boolean> {
  const result = await runValidationWithDetails(context);
  return result.passed;
}

/**
 * Run validation and return detailed results including captured errors.
 * Used by JSON mode to include validation errors in the response.
 */
export async function runValidationWithDetails(context: SyncContext): Promise<ValidationResult> {
  log(context.options, '\n🔍 Running post-sync validation...');

  let tsPass = false;
  let lintPass = false;
  let tsErrors: string[] = [];
  let lintErrors: string[] = [];

  // Run TypeScript check
  log(context.options, '\n📘 Running TypeScript check...');
  try {
    if (context.options.json) {
      // In JSON mode, capture output silently
      execSync('yarn ts', {
        cwd: context.projectRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } else {
      exec('yarn ts', context.projectRoot, { silent: false });
    }
    tsPass = true;
  } catch (error: unknown) {
    if (!context.options.json) {
      logError('❌ TypeScript check failed!');
    }
    // Capture error output
    if (error && typeof error === 'object' && 'stdout' in error) {
      const stdout = (error as { stdout?: string }).stdout;
      if (stdout) {
        tsErrors = stdout.split('\n').filter((line: string) => line.trim()).slice(0, 50);
      }
    }
    if (error && typeof error === 'object' && 'stderr' in error) {
      const stderr = (error as { stderr?: string }).stderr;
      if (stderr && tsErrors.length === 0) {
        tsErrors = stderr.split('\n').filter((line: string) => line.trim()).slice(0, 50);
      }
    }
  }

  // Run ESLint check
  log(context.options, '\n📋 Running ESLint check...');
  try {
    if (context.options.json) {
      // In JSON mode, capture output silently
      execSync('yarn lint', {
        cwd: context.projectRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } else {
      exec('yarn lint', context.projectRoot, { silent: false });
    }
    lintPass = true;
  } catch (error: unknown) {
    if (!context.options.json) {
      logError('❌ ESLint check failed!');
    }
    // Capture error output
    if (error && typeof error === 'object' && 'stdout' in error) {
      const stdout = (error as { stdout?: string }).stdout;
      if (stdout) {
        lintErrors = stdout.split('\n').filter((line: string) => line.trim()).slice(0, 50);
      }
    }
    if (error && typeof error === 'object' && 'stderr' in error) {
      const stderr = (error as { stderr?: string }).stderr;
      if (stderr && lintErrors.length === 0) {
        lintErrors = stderr.split('\n').filter((line: string) => line.trim()).slice(0, 50);
      }
    }
  }

  const passed = tsPass && lintPass;

  // Both must pass
  if (passed) {
    log(context.options, '✅ Validation passed!');
  } else {
    logError('⚠️  Validation failed!');
    logError('   Please review the changes and fix any issues.');
  }

  return {
    passed,
    tsPass,
    lintPass,
    tsErrors,
    lintErrors,
  };
}
