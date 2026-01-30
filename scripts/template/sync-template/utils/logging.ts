/**
 * Logging utilities for the Template Sync Tool
 */

import { SyncOptions } from '../types';

/**
 * Log a message (respects quiet mode)
 */
export function log(options: SyncOptions, message: string): void {
  if (!options.quiet) {
    console.log(message);
  }
}

/**
 * Log a verbose/debug message (only in verbose mode)
 */
export function logVerbose(options: SyncOptions, message: string): void {
  if (options.verbose) {
    console.log(`[DEBUG] ${message}`);
  }
}

/**
 * Log an error message (always shown)
 */
export function logError(message: string): void {
  console.error(message);
}
