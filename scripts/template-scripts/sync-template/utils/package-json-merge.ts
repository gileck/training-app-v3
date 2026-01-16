/**
 * Package.json smart merge utility
 *
 * Performs 3-way merge of package.json files at the field level:
 * - base: The version from the last sync (baseline)
 * - template: The current template version
 * - project: The current project version
 *
 * Merge logic:
 * - If only template changed a field → use template value
 * - If only project changed a field → keep project value
 * - If both changed the SAME field → keep project value + report conflict
 * - If both changed DIFFERENT fields → merge both (auto-merge)
 */

import * as fs from 'fs';
import * as path from 'path';
import { TEMPLATE_DIR } from '../types';
import { select, isInteractive, SelectOption } from '../../cli-utils';

// ============================================================================
// Types
// ============================================================================

export interface FieldConflict {
  field: string;
  baseValue: unknown;
  templateValue: unknown;
  projectValue: unknown;
}

export interface PackageJsonMergeResult {
  success: boolean;
  merged: Record<string, unknown> | null;
  autoMergedFields: string[];         // Fields that were auto-merged from template
  projectKeptFields: string[];        // Fields where project changes were kept
  conflicts: FieldConflict[];         // Fields where both changed (kept project value)
  templateOnlyFields: string[];       // Fields only in template (added)
  projectOnlyFields: string[];        // Fields only in project (kept)
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Deep equality check for JSON values
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a as object);
    const bKeys = Object.keys(b as object);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(key =>
      deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
    );
  }

  return false;
}

/**
 * Deep merge two objects, with second object taking precedence
 */
function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  for (const key of Object.keys(override)) {
    const baseVal = base[key];
    const overrideVal = override[key];

    if (
      baseVal !== null &&
      overrideVal !== null &&
      typeof baseVal === 'object' &&
      typeof overrideVal === 'object' &&
      !Array.isArray(baseVal) &&
      !Array.isArray(overrideVal)
    ) {
      // Both are objects, merge recursively
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overrideVal as Record<string, unknown>
      );
    } else {
      // Override takes precedence
      result[key] = overrideVal;
    }
  }

  return result;
}

/**
 * Get all top-level keys from multiple objects
 */
function getAllKeys(...objects: Record<string, unknown>[]): string[] {
  const keys = new Set<string>();
  for (const obj of objects) {
    for (const key of Object.keys(obj)) {
      keys.add(key);
    }
  }
  return Array.from(keys);
}

/**
 * Format a value for display in conflict messages
 */
export function formatValue(value: unknown): string {
  if (value === undefined) return '(not set)';
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

// ============================================================================
// Main Merge Function
// ============================================================================

/**
 * Perform a 3-way merge of package.json files
 *
 * @param base - The baseline version (from last sync)
 * @param template - The current template version
 * @param project - The current project version
 * @returns Merge result with merged content and conflict info
 */
export function mergePackageJson(
  base: Record<string, unknown> | null,
  template: Record<string, unknown>,
  project: Record<string, unknown>
): PackageJsonMergeResult {
  const result: PackageJsonMergeResult = {
    success: true,
    merged: {},
    autoMergedFields: [],
    projectKeptFields: [],
    conflicts: [],
    templateOnlyFields: [],
    projectOnlyFields: [],
  };

  // If no baseline, we can't do a proper 3-way merge
  // Fall back to reporting all differences as conflicts
  if (!base) {
    const allKeys = getAllKeys(template, project);
    const merged: Record<string, unknown> = { ...project };

    for (const key of allKeys) {
      const inTemplate = key in template;
      const inProject = key in project;
      const templateVal = template[key];
      const projectVal = project[key];

      if (inTemplate && inProject) {
        if (!deepEqual(templateVal, projectVal)) {
          // Both have the field with different values - conflict
          result.conflicts.push({
            field: key,
            baseValue: undefined,
            templateValue: templateVal,
            projectValue: projectVal,
          });
        }
        // Keep project value in merged
        merged[key] = projectVal;
      } else if (inTemplate && !inProject) {
        // Only in template - add it
        merged[key] = templateVal;
        result.templateOnlyFields.push(key);
      } else if (!inTemplate && inProject) {
        // Only in project - keep it
        merged[key] = projectVal;
        result.projectOnlyFields.push(key);
      }
    }

    result.merged = merged;
    return result;
  }

  // 3-way merge with baseline
  const allKeys = getAllKeys(base, template, project);
  const merged: Record<string, unknown> = {};

  for (const key of allKeys) {
    const baseVal = base[key];
    const templateVal = template[key];
    const projectVal = project[key];

    const inBase = key in base;
    const inTemplate = key in template;
    const inProject = key in project;

    const templateChanged = !deepEqual(baseVal, templateVal);
    const projectChanged = !deepEqual(baseVal, projectVal);

    // Case 1: New field in template (not in base or project)
    if (inTemplate && !inBase && !inProject) {
      merged[key] = templateVal;
      result.templateOnlyFields.push(key);
      continue;
    }

    // Case 2: New field in project (not in base or template)
    if (inProject && !inBase && !inTemplate) {
      merged[key] = projectVal;
      result.projectOnlyFields.push(key);
      continue;
    }

    // Case 3: Field removed from template
    if (inBase && !inTemplate && inProject) {
      if (projectChanged) {
        // Project modified it, keep project version
        merged[key] = projectVal;
        result.projectKeptFields.push(key);
      }
      // If project didn't change it, don't include (follow template's removal)
      // But we need to mention this was auto-merged
      else {
        result.autoMergedFields.push(`${key} (removed)`);
      }
      continue;
    }

    // Case 4: Field removed from project
    if (inBase && inTemplate && !inProject) {
      // Project intentionally removed it, keep project's decision (don't add back)
      result.projectKeptFields.push(`${key} (removed)`);
      continue;
    }

    // Case 5: Field exists in all three or combinations thereof
    if (templateChanged && projectChanged) {
      // Both changed - check if they made the same change
      if (deepEqual(templateVal, projectVal)) {
        // Same change - no conflict
        merged[key] = projectVal;
        result.autoMergedFields.push(key);
      } else {
        // Different changes - CONFLICT
        // Keep project value but report the conflict
        merged[key] = projectVal;
        result.conflicts.push({
          field: key,
          baseValue: baseVal,
          templateValue: templateVal,
          projectValue: projectVal,
        });
      }
    } else if (templateChanged && !projectChanged) {
      // Only template changed - use template value (auto-merge)
      merged[key] = templateVal;
      result.autoMergedFields.push(key);
    } else if (!templateChanged && projectChanged) {
      // Only project changed - keep project value
      merged[key] = projectVal;
      result.projectKeptFields.push(key);
    } else {
      // Neither changed - use the value (all same)
      merged[key] = projectVal ?? templateVal ?? baseVal;
    }
  }

  // Preserve original key order: start with project keys, then add new template keys
  const orderedMerged: Record<string, unknown> = {};

  // First, add all project keys in their original order
  for (const key of Object.keys(project)) {
    if (key in merged) {
      orderedMerged[key] = merged[key];
    }
  }

  // Then add any new keys from template
  for (const key of Object.keys(merged)) {
    if (!(key in orderedMerged)) {
      orderedMerged[key] = merged[key];
    }
  }

  result.merged = orderedMerged;
  return result;
}

// ============================================================================
// File-Level Functions
// ============================================================================

/**
 * Read and parse a package.json file
 */
export function readPackageJson(filePath: string): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Write a package.json file with proper formatting
 */
export function writePackageJson(filePath: string, content: Record<string, unknown>): void {
  const json = JSON.stringify(content, null, 2) + '\n';
  fs.writeFileSync(filePath, json, 'utf-8');
}

/**
 * Perform a 3-way merge of package.json files from file paths
 *
 * @param projectRoot - The project root directory
 * @param basePackageJson - The baseline package.json content (from stored state or null)
 * @returns Merge result
 */
export function mergePackageJsonFiles(
  projectRoot: string,
  basePackageJson: Record<string, unknown> | null
): PackageJsonMergeResult {
  const templatePath = path.join(projectRoot, TEMPLATE_DIR, 'package.json');
  const projectPath = path.join(projectRoot, 'package.json');

  const template = readPackageJson(templatePath);
  const project = readPackageJson(projectPath);

  if (!template || !project) {
    return {
      success: false,
      merged: null,
      autoMergedFields: [],
      projectKeptFields: [],
      conflicts: [],
      templateOnlyFields: [],
      projectOnlyFields: [],
    };
  }

  return mergePackageJson(basePackageJson, template, project);
}

/**
 * Format conflict messages for display
 */
export function formatConflictMessage(conflicts: FieldConflict[]): string {
  if (conflicts.length === 0) return '';

  const lines: string[] = [
    '',
    '⚠️  package.json field conflicts (project values kept):',
    '─'.repeat(60),
  ];

  for (const conflict of conflicts) {
    lines.push(`  Field: "${conflict.field}"`);
    lines.push(`    Template wants: ${formatValue(conflict.templateValue)}`);
    lines.push(`    Project has:    ${formatValue(conflict.projectValue)}`);
    if (conflict.baseValue !== undefined) {
      lines.push(`    Base was:       ${formatValue(conflict.baseValue)}`);
    }
    lines.push('');
  }

  lines.push('─'.repeat(60));
  lines.push('  Review these fields manually if you want template changes.');

  return lines.join('\n');
}

/**
 * Format merge summary for display
 */
export function formatMergeSummary(result: PackageJsonMergeResult): string {
  const lines: string[] = [];

  if (result.autoMergedFields.length > 0) {
    lines.push(`  ✅ Auto-merged from template: ${result.autoMergedFields.join(', ')}`);
  }

  if (result.projectKeptFields.length > 0) {
    lines.push(`  📌 Kept project values: ${result.projectKeptFields.join(', ')}`);
  }

  if (result.templateOnlyFields.length > 0) {
    lines.push(`  ➕ Added from template: ${result.templateOnlyFields.join(', ')}`);
  }

  if (result.projectOnlyFields.length > 0) {
    lines.push(`  📝 Project-only fields: ${result.projectOnlyFields.join(', ')}`);
  }

  if (result.conflicts.length > 0) {
    lines.push(`  ⚠️  Conflicts (project kept): ${result.conflicts.map(c => c.field).join(', ')}`);
  }

  return lines.join('\n');
}

// ============================================================================
// Interactive Field Conflict Resolution
// ============================================================================

export type FieldResolution = 'project' | 'template' | 'skip';

export interface FieldResolutionResult {
  field: string;
  resolution: FieldResolution;
  value: unknown;
}

/**
 * Prompt user to resolve a single field conflict
 */
async function promptFieldResolution(conflict: FieldConflict): Promise<FieldResolution> {
  console.log('\n' + '─'.repeat(60));
  console.log(`\n📦 Field: \x1b[1m${conflict.field}\x1b[0m\n`);

  // Show values
  console.log(`  \x1b[36mTemplate value:\x1b[0m`);
  console.log(`    ${formatValue(conflict.templateValue)}`);
  console.log('');
  console.log(`  \x1b[33mProject value:\x1b[0m`);
  console.log(`    ${formatValue(conflict.projectValue)}`);

  if (conflict.baseValue !== undefined) {
    console.log('');
    console.log(`  \x1b[90mBase value:\x1b[0m`);
    console.log(`    ${formatValue(conflict.baseValue)}`);
  }

  const options: SelectOption<FieldResolution>[] = [
    {
      label: 'Keep project value',
      value: 'project',
      description: 'Keep your current value',
    },
    {
      label: 'Use template value',
      value: 'template',
      description: 'Replace with template value',
    },
    {
      label: 'Skip (decide later)',
      value: 'skip',
      description: 'Leave unchanged for manual review',
    },
  ];

  const result = await select(`Choose value for "${conflict.field}":`, options);
  return result ?? 'project'; // Default to project if cancelled
}

/**
 * Interactively resolve all field conflicts in package.json
 * Returns the updated merge result with resolved conflicts
 */
export async function resolveFieldConflictsInteractively(
  mergeResult: PackageJsonMergeResult
): Promise<PackageJsonMergeResult> {
  if (!mergeResult.success || !mergeResult.merged || mergeResult.conflicts.length === 0) {
    return mergeResult;
  }

  if (!isInteractive()) {
    console.log('\n⚠️  Non-interactive mode - keeping project values for all conflicts');
    return mergeResult;
  }

  console.log('\n' + '='.repeat(60));
  console.log('📦 PACKAGE.JSON FIELD CONFLICTS');
  console.log('='.repeat(60));
  console.log(`\n${mergeResult.conflicts.length} field(s) changed in both template and project.`);
  console.log('Choose which value to use for each field:\n');

  const resolvedConflicts: FieldConflict[] = [];
  const updatedMerged = { ...mergeResult.merged };
  const resolvedFields: string[] = [];

  for (const conflict of mergeResult.conflicts) {
    const resolution = await promptFieldResolution(conflict);

    switch (resolution) {
      case 'template':
        // Use template value
        updatedMerged[conflict.field] = conflict.templateValue;
        resolvedFields.push(`${conflict.field} (template)`);
        break;
      case 'project':
        // Keep project value (already in merged)
        resolvedFields.push(`${conflict.field} (project)`);
        break;
      case 'skip':
        // Leave as project value but mark as unresolved
        resolvedConflicts.push(conflict);
        break;
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log('📊 RESOLUTION SUMMARY');
  console.log('─'.repeat(60));

  if (resolvedFields.length > 0) {
    console.log(`\n✅ Resolved: ${resolvedFields.join(', ')}`);
  }

  if (resolvedConflicts.length > 0) {
    console.log(`\n⚠️  Skipped (manual review needed): ${resolvedConflicts.map(c => c.field).join(', ')}`);
  }

  return {
    ...mergeResult,
    merged: updatedMerged,
    conflicts: resolvedConflicts,
  };
}
