/**
 * Shell command execution utilities
 */

import { execSync } from 'child_process';

export interface ExecOptions {
  cwd?: string;
  silent?: boolean;
}

/**
 * Execute a shell command and return the output
 */
export function exec(
  command: string,
  projectRoot: string,
  options: ExecOptions = {}
): string {
  try {
    const result = execSync(command, {
      cwd: options.cwd || projectRoot,
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
    });

    // NOTE:
    // When stdio is 'inherit', execSync returns null (output is streamed directly),
    // so we must not call .toString() on it.
    if (result == null) {
      return '';
    }

    return result.toString().trim();
  } catch (error: unknown) {
    if (!options.silent) {
      throw error;
    }
    return '';
  }
}

/**
 * Strip ANSI escape codes from a string.
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}
