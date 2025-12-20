#!/usr/bin/env tsx

/**
 * Template Sync Script
 * 
 * This script helps merge updates from the template repository into a project
 * that was created from the template.
 * 
 * Usage:
 *   yarn sync-template [options]
 * 
 * Options:
 *   --dry-run                Show what would be done without making changes
 *   --force                  Force update even if there are uncommitted changes
 *   --diff-summary           Generate a diff summary file showing all template changes
 *   --changelog              Show template commits since last sync (no sync)
 *   --validate               Run 'yarn checks' after sync to verify changes
 *   --report                 Generate a sync report file (SYNC-REPORT.md)
 *   --quiet                  Minimal output (errors only)
 *   --verbose                Detailed output for debugging
 * 
 * Auto modes (non-interactive):
 *   --auto-safe-only         Apply only safe changes, skip all conflicts
 *   --auto-merge-conflicts   Apply all changes, create .template files for conflicts
 *   --auto-override-conflicts Apply all changes, override conflicts with template version
 *   --auto-skip-conflicts    Apply safe changes, skip all conflicting files
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as readline from 'readline';
import { describeChanges, isAgentAvailable } from './ai-agent';
import { select, confirm, isInteractive, SelectOption } from './cli-utils';

interface SyncHistoryEntry {
  date: string;
  templateCommit: string;
  projectCommit: string;
  filesApplied: number;
  filesSkipped: number;
  filesConflicted: number;
  templateCommits: string[];  // Commit messages synced
}

interface TemplateSyncConfig {
  templateRepo: string;
  templateBranch: string;
  baseCommit: string | null;
  lastSyncCommit: string | null;
  lastProjectCommit: string | null;
  lastSyncDate: string | null;
  ignoredFiles: string[];
  projectSpecificFiles: string[];
  syncHistory?: SyncHistoryEntry[];  // Track sync history
}

interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  inTemplate: boolean;
  inProject: boolean;
}

interface SyncResult {
  autoMerged: string[];
  conflicts: string[];
  projectOnlyChanges: string[];  // Only changed in project - kept as-is
  skipped: string[];
  errors: string[];
}

interface AnalysisResult {
  safeChanges: FileChange[];        // Only changed in template - safe to auto-apply
  conflictChanges: FileChange[];    // Changed in BOTH - needs manual merge
  projectOnlyChanges: FileChange[]; // Only changed in project - keep as-is
  skipped: string[];
}

type SyncMode = 'safe' | 'all' | 'none';

type ConflictResolution = 'override' | 'skip' | 'merge' | 'nothing';

interface ConflictResolutionMap {
  [filePath: string]: ConflictResolution;
}

const CONFIG_FILE = '.template-sync.json';
const TEMPLATE_DIR = '.template-sync-temp';
const DIFF_SUMMARY_FILE = 'template-diff-summary.md';
const SYNC_REPORT_FILE = 'SYNC-REPORT.md';
const MAX_SYNC_HISTORY = 20;  // Keep last 20 syncs

type AutoMode = 'none' | 'safe-only' | 'merge-conflicts' | 'override-conflicts' | 'skip-conflicts';

interface SyncOptions {
  dryRun: boolean;
  force: boolean;
  autoMode: AutoMode;
  diffSummary: boolean;
  changelog: boolean;
  validate: boolean;
  report: boolean;
  quiet: boolean;
  verbose: boolean;
}

class TemplateSyncTool {
  private config: TemplateSyncConfig;
  private projectRoot: string;
  private options: SyncOptions;
  private rl: readline.Interface;

  constructor(options: SyncOptions) {
    this.projectRoot = process.cwd();
    this.options = options;
    this.config = this.loadConfig();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  // Logging helpers for quiet/verbose modes
  private log(message: string): void {
    if (!this.options.quiet) {
      console.log(message);
    }
  }

  private logVerbose(message: string): void {
    if (this.options.verbose) {
      console.log(`[DEBUG] ${message}`);
    }
  }

  private logError(message: string): void {
    console.error(message);  // Always show errors
  }

  private loadConfig(): TemplateSyncConfig {
    const configPath = path.join(this.projectRoot, CONFIG_FILE);

    if (!fs.existsSync(configPath)) {
      console.error('❌ Error: .template-sync.json not found.');
      console.error('Run "yarn init-template" first to initialize template tracking.');
      process.exit(1);
    }

    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }

  private saveConfig(): void {
    const configPath = path.join(this.projectRoot, CONFIG_FILE);
    fs.writeFileSync(
      configPath,
      JSON.stringify(this.config, null, 2) + '\n',
      'utf-8'
    );
  }

  private exec(command: string, options: { cwd?: string; silent?: boolean } = {}): string {
    try {
      return execSync(command, {
        cwd: options.cwd || this.projectRoot,
        encoding: 'utf-8',
        stdio: options.silent ? 'pipe' : 'inherit',
      }).toString().trim();
    } catch (error: any) {
      if (!options.silent) {
        throw error;
      }
      return '';
    }
  }

  private checkGitStatus(): void {
    const status = this.exec('git status --porcelain', { silent: true });

    if (status && !this.options.force) {
      console.error('❌ Error: You have uncommitted changes.');
      console.error('Please commit or stash your changes before syncing the template.');
      console.error('Or use --force to override this check.');
      process.exit(1);
    }
  }

  private cloneTemplate(): void {
    const templatePath = path.join(this.projectRoot, TEMPLATE_DIR);

    // Clean up any existing template directory
    if (fs.existsSync(templatePath)) {
      fs.rmSync(templatePath, { recursive: true, force: true });
    }

    console.log(`📥 Cloning template from ${this.config.templateRepo}...`);
    // Clone with full history to enable comparison with lastSyncCommit
    this.exec(
      `git clone --branch ${this.config.templateBranch} ${this.config.templateRepo} ${TEMPLATE_DIR}`,
      { silent: true }
    );
  }

  private cleanupTemplate(): void {
    const templatePath = path.join(this.projectRoot, TEMPLATE_DIR);
    if (fs.existsSync(templatePath)) {
      fs.rmSync(templatePath, { recursive: true, force: true });
    }
  }

  private getAllFiles(dir: string, baseDir = dir): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      // Skip ignored files/directories
      if (this.shouldIgnore(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        files.push(...this.getAllFiles(fullPath, baseDir));
      } else {
        files.push(relativePath);
      }
    }

    return files;
  }

  private shouldIgnore(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');

    return this.config.ignoredFiles.some(pattern => {
      // Normalize pattern
      const normalizedPattern = pattern.replace(/\\/g, '/');

      // Exact match
      if (normalized === normalizedPattern) return true;

      // Handle ** (match any number of path segments)
      if (normalizedPattern.includes('**')) {
        const regexPattern = normalizedPattern
          .replace(/\*\*/g, '.*')  // ** matches anything
          .replace(/\*/g, '[^/]*') // * matches anything except /
          .replace(/\//g, '\\/');  // escape slashes

        const regex = new RegExp('^' + regexPattern + '$');
        if (regex.test(normalized)) return true;
      }

      // Handle * (match within a single path segment)
      if (normalizedPattern.includes('*') && !normalizedPattern.includes('**')) {
        const regexPattern = normalizedPattern
          .replace(/\*/g, '[^/]*')  // * matches anything except /
          .replace(/\//g, '\\/');   // escape slashes

        const regex = new RegExp('^' + regexPattern + '$');
        if (regex.test(normalized)) return true;
      }

      // Directory match (if pattern is a directory name anywhere in path)
      if (normalized.split('/').includes(normalizedPattern)) return true;

      // Start with match (for directory paths)
      if (normalized.startsWith(normalizedPattern + '/')) return true;

      return false;
    });
  }

  private shouldIgnoreByProjectSpecificFiles(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');

    return this.config.projectSpecificFiles.some(pattern => {
      // Normalize pattern
      const normalizedPattern = pattern.replace(/\\/g, '/');

      // Exact match
      if (normalized === normalizedPattern) return true;

      // Handle ** (match any number of path segments)
      if (normalizedPattern.includes('**')) {
        const regexPattern = normalizedPattern
          .replace(/\*\*/g, '.*')  // ** matches anything
          .replace(/\*/g, '[^/]*') // * matches anything except /
          .replace(/\//g, '\\/');  // escape slashes

        const regex = new RegExp('^' + regexPattern + '$');
        if (regex.test(normalized)) return true;
      }

      // Handle * (match within a single path segment)
      if (normalizedPattern.includes('*') && !normalizedPattern.includes('**')) {
        const regexPattern = normalizedPattern
          .replace(/\*/g, '[^/]*')  // * matches anything except /
          .replace(/\//g, '\\/');   // escape slashes

        const regex = new RegExp('^' + regexPattern + '$');
        if (regex.test(normalized)) return true;
      }

      // Directory match (if pattern is a directory name anywhere in path)
      if (normalized.split('/').includes(normalizedPattern)) return true;

      // Start with match (for directory paths)
      if (normalized.startsWith(normalizedPattern + '/')) return true;

      return false;
    });
  }

  private getFileHash(filePath: string): string {
    if (!fs.existsSync(filePath)) return '';

    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  }

  private compareFiles(): FileChange[] {
    const templatePath = path.join(this.projectRoot, TEMPLATE_DIR);
    const templateFiles = this.getAllFiles(templatePath);
    const projectFiles = this.getAllFiles(this.projectRoot);

    const allFiles = Array.from(new Set([...templateFiles, ...projectFiles]));
    const changes: FileChange[] = [];

    for (const file of allFiles) {
      const templateFilePath = path.join(templatePath, file);
      const projectFilePath = path.join(this.projectRoot, file);

      const inTemplate = fs.existsSync(templateFilePath);
      const inProject = fs.existsSync(projectFilePath);

      if (!inProject && inTemplate) {
        // New file in template
        changes.push({
          path: file,
          status: 'added',
          inTemplate: true,
          inProject: false,
        });
      } else if (inProject && !inTemplate) {
        // File removed from template (keep in project)
        continue;
      } else if (inProject && inTemplate) {
        // File exists in both - check if different
        const templateHash = this.getFileHash(templateFilePath);
        const projectHash = this.getFileHash(projectFilePath);

        if (templateHash !== projectHash) {
          changes.push({
            path: file,
            status: 'modified',
            inTemplate: true,
            inProject: true,
          });
        }
      }
    }

    return changes;
  }

  private hasProjectChanges(filePath: string): boolean {
    // Check if file has been modified in the project since last sync
    try {
      // If we have the project commit from last sync, check against it
      if (this.config.lastProjectCommit) {
        const diff = this.exec(
          `git diff ${this.config.lastProjectCommit} HEAD -- "${filePath}"`,
          { silent: true }
        );
        return diff.length > 0;
      }

      // Otherwise, check if file is tracked and has history
      const log = this.exec(`git log --oneline -- "${filePath}"`, { silent: true });
      return log.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Check if a file has changed in the template since the last sync.
   * Returns true if the template modified this file.
   */
  private hasTemplateChanges(filePath: string): boolean {
    // If no lastSyncCommit, this is first sync - assume everything is new
    if (!this.config.lastSyncCommit) {
      return true;
    }

    const templatePath = path.join(this.projectRoot, TEMPLATE_DIR);

    try {
      // Check if file changed in template between lastSyncCommit and HEAD
      const diff = this.exec(
        `git diff ${this.config.lastSyncCommit} HEAD -- "${filePath}"`,
        { cwd: templatePath, silent: true }
      );
      return diff.length > 0;
    } catch {
      // If we can't determine (e.g., commit not found), assume changed to be safe
      return true;
    }
  }

  private analyzeChanges(changes: FileChange[]): AnalysisResult {
    const result: AnalysisResult = {
      safeChanges: [],
      conflictChanges: [],
      projectOnlyChanges: [],
      skipped: [],
    };

    for (const change of changes) {
      // Skip project-specific files (with glob pattern support)
      if (this.shouldIgnoreByProjectSpecificFiles(change.path)) {
        result.skipped.push(change.path);
        continue;
      }

      if (change.status === 'added') {
        // New file - safe to add
        result.safeChanges.push(change);
      } else if (change.status === 'modified') {
        // Check both sides for changes
        const templateChanged = this.hasTemplateChanges(change.path);
        const projectChanged = this.hasProjectChanges(change.path);

        if (templateChanged && projectChanged) {
          // TRUE conflict - both sides modified the file
          result.conflictChanges.push(change);
        } else if (templateChanged && !projectChanged) {
          // Only template changed - safe to auto-apply
          result.safeChanges.push(change);
        } else if (!templateChanged && projectChanged) {
          // Only project changed - this is a customization, NOT a conflict
          result.projectOnlyChanges.push(change);
        }
        // If neither changed, files should be identical (won't reach here)
      }
    }

    return result;
  }

  private async promptUser(analysis: AnalysisResult): Promise<SyncMode> {
    console.log('\n' + '='.repeat(60));
    console.log('📊 ANALYSIS SUMMARY');
    console.log('='.repeat(60));

    const aiAvailable = isAgentAvailable();

    if (analysis.safeChanges.length > 0) {
      console.log(`\n✅ Safe changes (${analysis.safeChanges.length} files):`);
      console.log('   Only changed in template, no conflicts:');
      
      // Generate AI descriptions for safe changes if available
      if (aiAvailable && analysis.safeChanges.length <= 10) {
        console.log('   🤖 Generating descriptions...\n');
        
        // Run all descriptions in parallel for speed
        const descriptionsPromises = analysis.safeChanges.map(async (f) => {
          const diffSummary = this.getFileDiffSummary(f.path);
          const description = await this.getAIDescription(diffSummary.diff, `Template changes to ${f.path}`);
          return { path: f.path, description };
        });
        
        const descriptions = await Promise.all(descriptionsPromises);
        
        for (const { path, description } of descriptions) {
          if (description) {
            console.log(`   • ${path}`);
            console.log(`     📝 ${description}`);
          } else {
            console.log(`   • ${path}`);
          }
        }
      } else {
        analysis.safeChanges.forEach(f =>
          console.log(`   • ${f.path}`)
        );
        if (analysis.safeChanges.length > 10) {
          console.log('   (AI descriptions skipped for large batch)');
        }
      }
    }

    if (analysis.conflictChanges.length > 0) {
      console.log(`\n⚠️  Potential conflicts (${analysis.conflictChanges.length} files):`);
      console.log('   Changed in both template and your project:');
      analysis.conflictChanges.forEach(f =>
        console.log(`   • ${f.path}`)
      );
    }

    if (analysis.projectOnlyChanges.length > 0) {
      console.log(`\n✅ Project customizations (${analysis.projectOnlyChanges.length} files):`);
      console.log('   Changed only in your project (template unchanged):');
      analysis.projectOnlyChanges.forEach(f =>
        console.log(`   • ${f.path}`)
      );
    }

    if (analysis.skipped.length > 0) {
      console.log(`\n⏭️  Skipped (${analysis.skipped.length} files) - \x1b[90mproject-specific, press [s] to show\x1b[0m`);

      // Warning about skipped files
      console.log('\n' + '─'.repeat(60));
      console.log('⚠️  WARNING: Skipped files have template changes!');
      console.log('   These changes will NOT be applied to your project.');
      console.log('   If synced files depend on skipped file changes, your code may break.');
      console.log('─'.repeat(60));
    }

    console.log('\n' + '='.repeat(60));
    
    if (analysis.projectOnlyChanges.length > 0) {
      console.log('\n   ℹ️  Note: Project customizations will be kept automatically.');
    }

    // Build menu options
    type MenuOption = SyncMode | 'show-skipped';
    const options: SelectOption<MenuOption>[] = [
      { 
        value: 'safe', 
        label: 'Safe only',
        description: 'Apply only safe changes (skip conflicts)'
      },
      { 
        value: 'all', 
        label: 'All changes',
        description: 'Apply safe changes + choose how to handle each conflict'
      },
      { 
        value: 'none', 
        label: 'Cancel',
        description: "Don't apply any changes"
      },
    ];

    // Add option to show skipped files if there are any
    if (analysis.skipped.length > 0) {
      options.push({
        value: 'show-skipped',
        label: 'Show skipped files',
        description: `View the ${analysis.skipped.length} skipped project-specific files`
      });
    }

    // Loop to handle "show skipped" option
    while (true) {
      let result: MenuOption | null;

      if (isInteractive()) {
        result = await select('🤔 What would you like to do?', options);
      } else {
        // Fallback for non-TTY
        console.log('\n🤔 What would you like to do?\n');
        options.forEach((opt, i) => {
          console.log(`  [${i + 1}] ${opt.label} - ${opt.description}`);
        });
        console.log('');
        
        result = await new Promise<MenuOption | null>((resolve) => {
          this.rl.question(`Enter your choice (1-${options.length}): `, (answer) => {
            const index = parseInt(answer.trim()) - 1;
            if (index >= 0 && index < options.length) {
              resolve(options[index].value);
            } else {
              resolve(null);
            }
          });
        });
      }

      // Handle show skipped option
      if (result === 'show-skipped') {
        console.log('\n' + '─'.repeat(60));
        console.log(`⏭️  Skipped files (${analysis.skipped.length}):`);
        console.log('   Project-specific files (ignored):');
        analysis.skipped.forEach(f => console.log(`   • ${f}`));
        console.log('─'.repeat(60));
        continue; // Go back to menu
      }

      // Return the sync mode
      if (result === 'safe' || result === 'all' || result === 'none') {
        return result;
      }
      
      return 'none'; // Default if cancelled
    }
  }

  private printConflictResolutionOptions(): void {
    console.log('');
    console.log('  [1] Override with template - Replace your changes with template version');
    console.log('  [2] Skip file              - Keep your current version, ignore template');
    console.log('  [3] Merge                  - Apply template changes (may cause conflicts)');
    console.log('  [4] Do nothing             - Leave file unchanged for now');
    console.log('');
  }

  private parseConflictResolution(input: string): ConflictResolution | null {
    const choice = input.trim();
    switch (choice) {
      case '1': return 'override';
      case '2': return 'skip';
      case '3': return 'merge';
      case '4': return 'nothing';
      default: return null;
    }
  }

  private async promptConflictResolutionMode(conflictCount: number): Promise<'bulk' | 'individual'> {
    console.log('\n' + '─'.repeat(60));
    console.log(`⚠️  CONFLICT RESOLUTION (${conflictCount} files)`);
    console.log('─'.repeat(60));

    const options: SelectOption<'bulk' | 'individual'>[] = [
      { 
        value: 'bulk', 
        label: 'Apply same action to all',
        description: 'Choose one action for all conflicting files'
      },
      { 
        value: 'individual', 
        label: 'Choose per file',
        description: 'Review and choose action for each file individually'
      },
    ];

    if (isInteractive()) {
      const result = await select('How would you like to handle conflicts?', options);
      return result ?? 'bulk';
    } else {
      console.log('\nHow would you like to handle the conflicting files?\n');
      options.forEach((opt, i) => {
        console.log(`  [${i + 1}] ${opt.label} - ${opt.description}`);
      });
      console.log('');
      
      return new Promise((resolve) => {
        this.rl.question('Enter your choice (1/2): ', (answer) => {
          resolve(answer.trim() === '2' ? 'individual' : 'bulk');
        });
      });
    }
  }

  private getConflictResolutionOptions(): SelectOption<ConflictResolution>[] {
    return [
      { 
        value: 'override', 
        label: 'Override with template',
        description: 'Replace your changes with template version'
      },
      { 
        value: 'skip', 
        label: 'Skip file',
        description: 'Keep your current version, ignore template'
      },
      { 
        value: 'merge', 
        label: 'Merge',
        description: 'Apply template changes (may cause conflicts)'
      },
      { 
        value: 'nothing', 
        label: 'Do nothing',
        description: 'Leave file unchanged for now'
      },
    ];
  }

  private async promptBulkConflictResolution(): Promise<ConflictResolution> {
    const options = this.getConflictResolutionOptions();

    if (isInteractive()) {
      const result = await select('📋 Choose action for ALL conflicting files:', options);
      return result ?? 'nothing';
    } else {
      console.log('\n📋 Choose the action to apply to ALL conflicting files:');
      this.printConflictResolutionOptions();
      
      return new Promise((resolve) => {
        this.rl.question('Enter your choice (1/2/3/4): ', (answer) => {
          const resolution = this.parseConflictResolution(answer);
          resolve(resolution ?? 'nothing');
        });
      });
    }
  }

  /**
   * Get a brief diff summary for a file (lines added/removed).
   */
  private getFileDiffSummary(filePath: string): { added: number; removed: number; preview: string[]; diff: string } {
    const templatePath = path.join(this.projectRoot, TEMPLATE_DIR);
    const templateFilePath = path.join(templatePath, filePath);
    const projectFilePath = path.join(this.projectRoot, filePath);

    try {
      const diff = this.exec(
        `diff -u "${projectFilePath}" "${templateFilePath}" || true`,
        { silent: true }
      );

      if (!diff.trim()) {
        return { added: 0, removed: 0, preview: [], diff: '' };
      }

      const lines = diff.split('\n');
      let added = 0;
      let removed = 0;
      const preview: string[] = [];

      for (const line of lines) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          added++;
          if (preview.length < 5) preview.push(line);
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          removed++;
          if (preview.length < 5) preview.push(line);
        }
      }

      return { added, removed, preview, diff };
    } catch {
      return { added: 0, removed: 0, preview: [], diff: '' };
    }
  }

  /**
   * Get AI-generated description of changes (returns null if unavailable)
   */
  private async getAIDescription(diff: string, context: string): Promise<string | null> {
    if (!diff.trim()) return null;
    
    try {
      return await describeChanges(diff, context);
    } catch {
      return null;
    }
  }

  /**
   * Get the local diff for a file (changes since last sync)
   */
  private getLocalDiff(filePath: string): string {
    if (!this.config.lastProjectCommit) return '';
    
    try {
      return this.exec(
        `git diff ${this.config.lastProjectCommit} HEAD -- "${filePath}" || true`,
        { silent: true }
      );
    } catch {
      return '';
    }
  }

  private async promptIndividualConflictResolution(
    conflicts: FileChange[]
  ): Promise<ConflictResolutionMap> {
    const resolutions: ConflictResolutionMap = {};
    const aiAvailable = isAgentAvailable();
    const interactive = isInteractive();

    console.log('\n📋 Choose an action for each conflicting file:\n');
    
    if (aiAvailable) {
      console.log('🤖 AI descriptions enabled (cursor-agent detected)\n');
    }

    const options = this.getConflictResolutionOptions();

    for (let i = 0; i < conflicts.length; i++) {
      const file = conflicts[i];
      console.log('─'.repeat(60));
      console.log(`\n📄 File ${i + 1} of ${conflicts.length}: \x1b[1m${file.path}\x1b[0m`);
      
      // Show diff preview
      const diffSummary = this.getFileDiffSummary(file.path);
      if (diffSummary.added > 0 || diffSummary.removed > 0) {
        console.log(`\n   📊 Template changes: \x1b[32m+${diffSummary.added}\x1b[0m lines, \x1b[31m-${diffSummary.removed}\x1b[0m lines`);
        
        // Get AI descriptions if available
        if (aiAvailable && diffSummary.diff) {
          console.log('   🤖 Analyzing changes...');
          
          const [templateDesc, localDesc] = await Promise.all([
            this.getAIDescription(diffSummary.diff, `Template changes to ${file.path}`),
            this.getAIDescription(this.getLocalDiff(file.path), `Your local changes to ${file.path}`),
          ]);
          
          // Clear the "Analyzing..." line and show descriptions
          process.stdout.write('\x1b[1A\x1b[2K'); // Move up and clear line
          
          if (templateDesc) {
            console.log(`   📝 Template: ${templateDesc}`);
          }
          if (localDesc) {
            console.log(`   📝 Your changes: ${localDesc}`);
          }
        }
        
        if (diffSummary.preview.length > 0 && !aiAvailable) {
          console.log('   Preview:');
          diffSummary.preview.forEach(line => {
            const color = line.startsWith('+') ? '\x1b[32m' : '\x1b[31m';
            console.log(`   ${color}${line}\x1b[0m`);
          });
          if (diffSummary.added + diffSummary.removed > 5) {
            console.log(`   ... and ${diffSummary.added + diffSummary.removed - 5} more changes`);
          }
        }
      }

      let resolution: ConflictResolution;

      if (interactive) {
        const result = await select(`Choose action for ${path.basename(file.path)}:`, options);
        resolution = result ?? 'nothing';
      } else {
        this.printConflictResolutionOptions();
        resolution = await new Promise<ConflictResolution>((resolve) => {
          this.rl.question(`Action for ${file.path} (1/2/3/4): `, (answer) => {
            const res = this.parseConflictResolution(answer);
            resolve(res ?? 'nothing');
          });
        });
      }

      resolutions[file.path] = resolution;
    }

    return resolutions;
  }

  private async handleConflictResolution(
    conflicts: FileChange[]
  ): Promise<ConflictResolutionMap> {
    if (conflicts.length === 0) {
      return {};
    }

    // Show list of conflicting files
    console.log('\n' + '='.repeat(60));
    console.log('📋 FILES WITH POTENTIAL CONFLICTS');
    console.log('='.repeat(60));
    console.log('\nThese files have changes in both your project AND the template:\n');
    conflicts.forEach((f, i) => console.log(`  ${i + 1}. ${f.path}`));

    // Ask user how they want to handle conflicts
    const mode = await this.promptConflictResolutionMode(conflicts.length);

    if (mode === 'bulk') {
      const resolution = await this.promptBulkConflictResolution();
      const resolutions: ConflictResolutionMap = {};
      for (const conflict of conflicts) {
        resolutions[conflict.path] = resolution;
      }
      return resolutions;
    } else {
      return this.promptIndividualConflictResolution(conflicts);
    }
  }

  private printConflictResolutionSummary(resolutions: ConflictResolutionMap): void {
    const counts = {
      override: 0,
      skip: 0,
      merge: 0,
      nothing: 0,
    };

    for (const resolution of Object.values(resolutions)) {
      counts[resolution]++;
    }

    console.log('\n' + '─'.repeat(60));
    console.log('📊 CONFLICT RESOLUTION SUMMARY');
    console.log('─'.repeat(60));

    if (counts.override > 0) {
      console.log(`\n🔄 Override with template (${counts.override} files):`);
      Object.entries(resolutions)
        .filter(([, r]) => r === 'override')
        .forEach(([path]) => console.log(`   • ${path}`));
    }

    if (counts.skip > 0) {
      console.log(`\n⏭️  Skip (${counts.skip} files):`);
      Object.entries(resolutions)
        .filter(([, r]) => r === 'skip')
        .forEach(([path]) => console.log(`   • ${path}`));
    }

    if (counts.merge > 0) {
      console.log(`\n🔀 Merge (${counts.merge} files):`);
      Object.entries(resolutions)
        .filter(([, r]) => r === 'merge')
        .forEach(([path]) => console.log(`   • ${path}`));
    }

    if (counts.nothing > 0) {
      console.log(`\n⏸️  Do nothing (${counts.nothing} files):`);
      Object.entries(resolutions)
        .filter(([, r]) => r === 'nothing')
        .forEach(([path]) => console.log(`   • ${path}`));
    }

    console.log('');
  }

  private async syncFiles(
    analysis: AnalysisResult,
    mode: SyncMode,
    conflictResolutions?: ConflictResolutionMap
  ): Promise<SyncResult> {
    const result: SyncResult = {
      autoMerged: [],
      conflicts: [],
      projectOnlyChanges: analysis.projectOnlyChanges.map(c => c.path),
      skipped: [...analysis.skipped],
      errors: [],
    };

    if (mode === 'none') {
      console.log('\n❌ Cancelled. No changes applied.');
      return result;
    }

    const templatePath = path.join(this.projectRoot, TEMPLATE_DIR);

    // Apply safe changes
    console.log(`\n🔄 Applying safe changes (${analysis.safeChanges.length} files)...\n`);

    for (const change of analysis.safeChanges) {
      const templateFilePath = path.join(templatePath, change.path);
      const projectFilePath = path.join(this.projectRoot, change.path);

      try {
        if (!this.options.dryRun) {
          const dir = path.dirname(projectFilePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.copyFileSync(templateFilePath, projectFilePath);
        }
        result.autoMerged.push(change.path);
      } catch (error: any) {
        result.errors.push(`${change.path}: ${error.message}`);
      }
    }

    // Handle conflicts based on mode and resolutions
    if (mode === 'all' && analysis.conflictChanges.length > 0) {
      console.log(`\n🔄 Processing conflicts (${analysis.conflictChanges.length} files)...\n`);

      for (const change of analysis.conflictChanges) {
        const templateFilePath = path.join(templatePath, change.path);
        const projectFilePath = path.join(this.projectRoot, change.path);
        const resolution = conflictResolutions?.[change.path] || 'merge';

        try {
          switch (resolution) {
            case 'override':
              // Replace project file with template version
              if (!this.options.dryRun) {
                const dir = path.dirname(projectFilePath);
                if (!fs.existsSync(dir)) {
                  fs.mkdirSync(dir, { recursive: true });
                }
                fs.copyFileSync(templateFilePath, projectFilePath);
              }
              result.autoMerged.push(change.path);
              break;

            case 'skip':
              // Keep project version, add to skipped
              result.skipped.push(change.path);
              break;

            case 'merge':
              // Save template version for manual merge (original behavior)
              result.conflicts.push(change.path);
              if (!this.options.dryRun) {
                fs.copyFileSync(templateFilePath, projectFilePath + '.template');
              }
              break;

            case 'nothing':
              // Leave file unchanged, don't add to any list
              // Just log that we skipped it
              break;
          }
        } catch (error: any) {
          result.errors.push(`${change.path}: ${error.message}`);
        }
      }
    }

    return result;
  }

  private printResults(result: SyncResult): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 SYNC RESULTS');
    console.log('='.repeat(60));

    if (result.autoMerged.length > 0) {
      console.log(`\n✅ Applied successfully (${result.autoMerged.length} files):`);
      result.autoMerged.forEach(f => console.log(`   ${f}`));
    }

    if (result.conflicts.length > 0) {
      console.log(`\n🔀 Needs manual merge (${result.conflicts.length} files):`);
      result.conflicts.forEach(f => {
        console.log(`   ${f}`);
        console.log(`      → Template version saved to: ${f}.template`);
      });
    }

    if (result.projectOnlyChanges && result.projectOnlyChanges.length > 0) {
      console.log(`\n✅ Project customizations kept (${result.projectOnlyChanges.length} files):`);
      console.log('   These files were only changed in your project:');
      result.projectOnlyChanges.forEach(f => console.log(`   ${f}`));
    }

    if (result.skipped.length > 0) {
      console.log(`\n⏭️  Skipped (${result.skipped.length} files):`);
      result.skipped.forEach(f => console.log(`   ${f}`));
    }

    if (result.errors.length > 0) {
      console.log(`\n❌ Errors (${result.errors.length}):`);
      result.errors.forEach(e => console.log(`   ${e}`));
    }

    console.log('\n' + '='.repeat(60));

    if (result.conflicts.length > 0) {
      console.log('\n💡 Next steps for manual merges:');
      console.log('   1. Review each conflict file');
      console.log('   2. Compare with the .template version');
      console.log('   3. Manually merge the changes');
      console.log('   4. Delete the .template files when done');
      console.log('   5. Commit your changes');
    }
  }

  /**
   * Get the list of template commits since the last sync.
   * Returns full commit messages including subject, body, and date.
   */
  private getTemplateCommitsSinceLastSync(): string[] {
    if (!this.config.lastSyncCommit) {
      return []; // First sync, no previous commits to show
    }

    const templatePath = path.join(this.projectRoot, TEMPLATE_DIR);

    try {
      // Get full commit messages between lastSyncCommit and HEAD
      // Format: hash, date, subject, then body - separated by a delimiter
      const log = this.exec(
        `git log ${this.config.lastSyncCommit}..HEAD --pretty=format:"---COMMIT---%n%h|%ad|%s%n%b" --date=short --no-decorate`,
        { cwd: templatePath, silent: true }
      );

      if (!log.trim()) {
        return [];
      }

      // Split by delimiter and process each commit
      const commits = log
        .split('---COMMIT---')
        .map(commit => commit.trim())
        .filter(commit => commit.length > 0)
        .map(commit => {
          const lines = commit.split('\n');
          // First line is "hash|date|subject"
          const firstLine = lines[0];
          const [hash, date, ...subjectParts] = firstLine.split('|');
          const subject = subjectParts.join('|'); // In case subject contains |
          
          // Remaining lines are the body
          const bodyLines = lines.slice(1);
          // Remove trailing empty lines from body
          while (bodyLines.length > 0 && !bodyLines[bodyLines.length - 1].trim()) {
            bodyLines.pop();
          }
          
          // Format: "hash subject (date)\nbody"
          const header = `${hash} ${subject} \x1b[90m(${date})\x1b[0m`;
          if (bodyLines.length > 0 && bodyLines.some(l => l.trim())) {
            // Indent body lines relative to header
            return header + '\n' + bodyLines.map(l => `  ${l}`).join('\n');
          }
          return header;
        });

      return commits;
    } catch {
      // If lastSyncCommit doesn't exist in template (force push, etc.), return empty
      return [];
    }
  }

  /**
   * Strip ANSI escape codes from a string.
   */
  private stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * Format template commits for the sync commit message.
   */
  private formatSyncCommitMessage(templateCommit: string, templateCommits: string[]): string {
    const shortCommit = templateCommit.slice(0, 7);
    
    if (templateCommits.length === 0) {
      return `chore: sync template (${shortCommit})`;
    }

    const header = `chore: sync template (${shortCommit})`;
    
    // Format commits with proper indentation for multi-line messages
    // Strip ANSI codes as they shouldn't be in commit messages
    const formattedCommits = templateCommits.map(commit => {
      const cleanCommit = this.stripAnsi(commit);
      const lines = cleanCommit.split('\n');
      if (lines.length === 1) {
        return `- ${cleanCommit}`;
      }
      // First line with bullet, rest indented
      return `- ${lines[0]}\n${lines.slice(1).map(l => `  ${l}`).join('\n')}`;
    });
    
    const body = '\n\nTemplate commits synced:\n\n' + formattedCommits.join('\n\n');
    
    return header + body;
  }

  /**
   * Run changelog mode - show template commits since last sync
   */
  private async runChangelog(): Promise<void> {
    this.log('📜 Template Changelog');
    this.log('='.repeat(60));

    // Clone template to get commits
    this.cloneTemplate();

    try {
      const templatePath = path.join(this.projectRoot, TEMPLATE_DIR);
      const templateCommit = this.exec('git rev-parse HEAD', {
        cwd: templatePath,
        silent: true,
      });

      this.log(`\n📍 Current template: ${templateCommit}`);
      
      if (this.config.lastSyncCommit) {
        this.log(`📍 Last synced:      ${this.config.lastSyncCommit}`);
        this.log(`📅 Last sync date:   ${this.config.lastSyncDate || 'unknown'}`);
      } else {
        this.log('📍 Last synced:      (never synced)');
      }

      const commits = this.getTemplateCommitsSinceLastSync();
      
      if (commits.length === 0) {
        this.log('\n✅ No new commits since last sync.');
      } else {
        this.log(`\n📝 New commits since last sync (${commits.length}):\n`);
        commits.forEach((c, i) => {
          // Indent each line of the commit message
          const indented = c.split('\n').map(line => `   ${line}`).join('\n');
          this.log(indented);
          if (i < commits.length - 1) {
            this.log(''); // Add blank line between commits
          }
        });
      }

      this.log('\n' + '='.repeat(60));
    } finally {
      this.cleanupTemplate();
    }
  }

  /**
   * Run post-sync validation (yarn checks)
   */
  private async runValidation(): Promise<boolean> {
    this.log('\n🔍 Running post-sync validation...');
    
    try {
      this.exec('yarn checks', { silent: false });
      this.log('✅ Validation passed!');
      return true;
    } catch (error: any) {
      this.logError('⚠️  Validation failed!');
      this.logError('   Please review the changes and fix any issues.');
      return false;
    }
  }

  /**
   * Generate a sync report file
   */
  private generateSyncReport(
    result: SyncResult,
    templateCommit: string,
    templateCommits: string[]
  ): void {
    const lines: string[] = [];
    const now = new Date().toISOString();

    lines.push('# Template Sync Report');
    lines.push('');
    lines.push(`**Generated:** ${now}`);
    lines.push(`**Template:** ${this.config.templateRepo}`);
    lines.push(`**Template Commit:** ${templateCommit}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push(`| Metric | Count |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Files Applied | ${result.autoMerged.length} |`);
    lines.push(`| Files Needing Merge | ${result.conflicts.length} |`);
    lines.push(`| Files Skipped | ${result.skipped.length} |`);
    lines.push(`| Project Customizations Kept | ${result.projectOnlyChanges.length} |`);
    lines.push(`| Errors | ${result.errors.length} |`);
    lines.push('');

    // Template commits
    if (templateCommits.length > 0) {
      lines.push('## Template Commits Synced');
      lines.push('');
      templateCommits.forEach(c => lines.push(`- ${c}`));
      lines.push('');
    }

    // Applied files
    if (result.autoMerged.length > 0) {
      lines.push('## Files Applied');
      lines.push('');
      result.autoMerged.forEach(f => lines.push(`- \`${f}\``));
      lines.push('');
    }

    // Conflicts
    if (result.conflicts.length > 0) {
      lines.push('## Files Needing Manual Merge');
      lines.push('');
      lines.push('These files have `.template` versions that need to be manually merged:');
      lines.push('');
      result.conflicts.forEach(f => lines.push(`- \`${f}\``));
      lines.push('');
    }

    // Skipped
    if (result.skipped.length > 0) {
      lines.push('## Skipped Files');
      lines.push('');
      result.skipped.forEach(f => lines.push(`- \`${f}\``));
      lines.push('');
    }

    // Errors
    if (result.errors.length > 0) {
      lines.push('## Errors');
      lines.push('');
      result.errors.forEach(e => lines.push(`- ${e}`));
      lines.push('');
    }

    // Write report
    const reportPath = path.join(this.projectRoot, SYNC_REPORT_FILE);
    fs.writeFileSync(reportPath, lines.join('\n'), 'utf-8');
    this.log(`\n📄 Sync report saved to: ${SYNC_REPORT_FILE}`);
  }

  /**
   * Add an entry to sync history
   */
  private addSyncHistoryEntry(
    templateCommit: string,
    projectCommit: string,
    result: SyncResult,
    templateCommits: string[]
  ): void {
    if (!this.config.syncHistory) {
      this.config.syncHistory = [];
    }

    const entry: SyncHistoryEntry = {
      date: new Date().toISOString(),
      templateCommit,
      projectCommit,
      filesApplied: result.autoMerged.length,
      filesSkipped: result.skipped.length,
      filesConflicted: result.conflicts.length,
      templateCommits,
    };

    this.config.syncHistory.unshift(entry);

    // Keep only last N entries
    if (this.config.syncHistory.length > MAX_SYNC_HISTORY) {
      this.config.syncHistory = this.config.syncHistory.slice(0, MAX_SYNC_HISTORY);
    }

    this.logVerbose(`Added sync history entry: ${templateCommit.slice(0, 7)}`);
  }

  private generateFileDiff(filePath: string): string {
    const templatePath = path.join(this.projectRoot, TEMPLATE_DIR);
    const templateFilePath = path.join(templatePath, filePath);
    const projectFilePath = path.join(this.projectRoot, filePath);

    const templateExists = fs.existsSync(templateFilePath);
    const projectExists = fs.existsSync(projectFilePath);

    if (!templateExists) {
      return '';
    }

    if (!projectExists) {
      // New file in template - show full content
      const content = fs.readFileSync(templateFilePath, 'utf-8');
      return `+++ NEW FILE +++\n${content}`;
    }

    // Both exist - generate unified diff
    try {
      const diff = this.exec(
        `diff -u "${projectFilePath}" "${templateFilePath}" || true`,
        { silent: true }
      );

      if (diff) {
        // Replace file paths in diff header for clarity
        return diff
          .replace(projectFilePath, `a/${filePath} (current)`)
          .replace(templateFilePath, `b/${filePath} (template)`);
      }
      return '(no differences)';
    } catch {
      return '(unable to generate diff)';
    }
  }

  private async runDiffSummary(): Promise<void> {
    console.log('📋 Generating Diff Summary');
    console.log('='.repeat(60));

    // Clone template
    this.cloneTemplate();

    try {
      // Get template commit
      const templatePath = path.join(this.projectRoot, TEMPLATE_DIR);
      const templateCommit = this.exec('git rev-parse HEAD', {
        cwd: templatePath,
        silent: true,
      });

      console.log(`📍 Template commit: ${templateCommit}\n`);

      // Compare files - get ALL changes (we'll handle skipped differently for diff-summary)
      console.log('🔍 Analyzing changes...');
      const changes = this.compareFiles();

      if (changes.length === 0) {
        console.log('✅ No changes detected. Your project is up to date!');
        return;
      }

      // Build the diff summary
      const lines: string[] = [];
      lines.push('# Template Diff Summary');
      lines.push('');
      lines.push(`Generated: ${new Date().toISOString()}`);
      lines.push(`Template: ${this.config.templateRepo}`);
      lines.push(`Template Commit: ${templateCommit}`);
      lines.push('');
      lines.push('This file shows all differences between the template and your current project.');
      lines.push('Only changes in the template are shown (files that exist only in your project are not included).');
      lines.push('');
      lines.push('---');
      lines.push('');

      // Categorize changes
      const safeChanges: FileChange[] = [];
      const conflictChanges: FileChange[] = [];
      const projectOnlyChanges: FileChange[] = [];
      const skippedChanges: FileChange[] = [];

      for (const change of changes) {
        if (this.shouldIgnoreByProjectSpecificFiles(change.path)) {
          skippedChanges.push(change);
        } else if (change.status === 'added') {
          safeChanges.push(change);
        } else if (change.status === 'modified') {
          const templateChanged = this.hasTemplateChanges(change.path);
          const projectChanged = this.hasProjectChanges(change.path);

          if (templateChanged && projectChanged) {
            conflictChanges.push(change);
          } else if (templateChanged && !projectChanged) {
            safeChanges.push(change);
          } else if (!templateChanged && projectChanged) {
            projectOnlyChanges.push(change);
          }
        }
      }

      // Summary section
      lines.push('## Summary');
      lines.push('');
      lines.push(`- **Safe changes** (can be auto-merged): ${safeChanges.length} files`);
      lines.push(`- **Potential conflicts** (changed in both): ${conflictChanges.length} files`);
      lines.push(`- **Project customizations** (kept as-is): ${projectOnlyChanges.length} files`);
      lines.push(`- **Skipped** (project-specific): ${skippedChanges.length} files`);
      lines.push(`- **Total**: ${changes.length} files`);
      lines.push('');

      // Table of contents
      lines.push('## Table of Contents');
      lines.push('');

      if (safeChanges.length > 0) {
        lines.push('### Safe Changes');
        safeChanges.forEach((c, i) => {
          const anchor = c.path.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
          lines.push(`${i + 1}. [${c.path}](#${anchor}) (${c.status})`);
        });
        lines.push('');
      }

      if (conflictChanges.length > 0) {
        lines.push('### Potential Conflicts');
        conflictChanges.forEach((c, i) => {
          const anchor = c.path.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
          lines.push(`${i + 1}. [${c.path}](#${anchor}) (${c.status})`);
        });
        lines.push('');
      }

      if (projectOnlyChanges.length > 0) {
        lines.push('### Project Customizations (Kept As-Is)');
        projectOnlyChanges.forEach((c, i) => {
          const anchor = `project-${c.path.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
          lines.push(`${i + 1}. [${c.path}](#${anchor}) (${c.status})`);
        });
        lines.push('');
      }

      if (skippedChanges.length > 0) {
        lines.push('### Skipped (Project-Specific)');
        skippedChanges.forEach((c, i) => {
          const anchor = `skipped-${c.path.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
          lines.push(`${i + 1}. [${c.path}](#${anchor}) (${c.status})`);
        });
        lines.push('');
      }

      lines.push('---');
      lines.push('');

      // Generate diffs for each category
      const addDiffSection = (title: string, changes: FileChange[], prefix = '') => {
        if (changes.length === 0) return;

        lines.push(`## ${title}`);
        lines.push('');

        for (const change of changes) {
          const anchor = prefix ? `${prefix}-${change.path}` : change.path;
          lines.push(`### ${anchor}`);
          lines.push('');
          lines.push(`**Status**: ${change.status}`);
          lines.push('');
          lines.push('```diff');
          lines.push(this.generateFileDiff(change.path));
          lines.push('```');
          lines.push('');
          lines.push('---');
          lines.push('');
        }
      };

      addDiffSection('Safe Changes (Can Auto-Merge)', safeChanges);
      addDiffSection('Potential Conflicts (Changed in Both)', conflictChanges);
      addDiffSection('Project Customizations (Kept As-Is)', projectOnlyChanges, 'project');
      addDiffSection('Skipped Files (Project-Specific)', skippedChanges, 'skipped');

      // Write to file
      const outputPath = path.join(this.projectRoot, DIFF_SUMMARY_FILE);
      fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');

      console.log('\n' + '='.repeat(60));
      console.log('📊 DIFF SUMMARY GENERATED');
      console.log('='.repeat(60));
      console.log(`\n✅ Output written to: ${DIFF_SUMMARY_FILE}`);
      console.log(`\n📈 Summary:`);
      console.log(`   • Safe changes: ${safeChanges.length} files`);
      console.log(`   • Potential conflicts: ${conflictChanges.length} files`);
      console.log(`   • Project customizations: ${projectOnlyChanges.length} files`);
      console.log(`   • Skipped: ${skippedChanges.length} files`);
      console.log(`   • Total: ${changes.length} files`);
      console.log('\n💡 Next steps:');
      console.log(`   1. Open ${DIFF_SUMMARY_FILE} to review all diffs`);
      console.log('   2. Decide which changes you want to apply');
      console.log('   3. Run "yarn sync-template" to apply changes');
      console.log('   4. Or manually copy specific changes from the diff');

    } finally {
      this.cleanupTemplate();
    }
  }

  async run(): Promise<void> {
    this.log('🔄 Template Sync Tool');
    this.log('='.repeat(60));

    // Handle changelog mode (just show commits, no sync)
    if (this.options.changelog) {
      await this.runChangelog();
      this.rl.close();
      return;
    }

    // Handle diff-summary mode
    if (this.options.diffSummary) {
      await this.runDiffSummary();
      this.rl.close();
      return;
    }

    if (this.options.dryRun) {
      this.log('🔍 DRY RUN MODE - No changes will be made\n');
    }

    // Step 1: Check git status
    if (!this.options.dryRun && !this.options.force) {
      this.checkGitStatus();
    }

    // Step 2: Clone template
    try {
      this.cloneTemplate();

      // Step 3: Get template commit
      const templatePath = path.join(this.projectRoot, TEMPLATE_DIR);
      const templateCommit = this.exec('git rev-parse HEAD', {
        cwd: templatePath,
        silent: true,
      });

      console.log(`📍 Template commit: ${templateCommit}`);
      
      // Show template commits since last sync
      const templateCommits = this.getTemplateCommitsSinceLastSync();
      if (templateCommits.length > 0) {
        console.log(`\n📜 Template commits since last sync (${templateCommits.length}):\n`);
        templateCommits.slice(0, 10).forEach((c, i) => {
          // Indent each line of the commit message
          const indented = c.split('\n').map(line => `   ${line}`).join('\n');
          console.log(indented);
          if (i < Math.min(templateCommits.length, 10) - 1) {
            console.log(''); // Add blank line between commits
          }
        });
        if (templateCommits.length > 10) {
          console.log(`\n   ... and ${templateCommits.length - 10} more`);
        }
      } else if (this.config.lastSyncCommit) {
        console.log('\n📜 No new template commits since last sync.');
      }
      console.log('');

      // Step 4: Compare files
      console.log('🔍 Analyzing changes...');
      const changes = this.compareFiles();

      if (changes.length === 0) {
        console.log('✅ No changes detected. Your project is up to date!');
        this.rl.close();
        return;
      }

      // Step 5: Analyze changes (categorize into safe/conflict)
      const analysis = this.analyzeChanges(changes);

      // Check if all changes are skipped or project-only (nothing to sync from template)
      const hasChangesToSync = analysis.safeChanges.length > 0 || analysis.conflictChanges.length > 0;

      if (!hasChangesToSync) {
        console.log('\n' + '='.repeat(60));
        console.log('📊 ANALYSIS SUMMARY');
        console.log('='.repeat(60));

        if (analysis.projectOnlyChanges.length > 0) {
          console.log(`\n✅ Project customizations (${analysis.projectOnlyChanges.length} files):`);
          console.log('   Changed only in your project (template unchanged):');
          analysis.projectOnlyChanges.forEach(f => console.log(`   • ${f.path}`));
        }

        if (analysis.skipped.length > 0) {
          console.log(`\n⏭️  Skipped files (${analysis.skipped.length} files):`);
          console.log('   These files are in your ignored/project-specific list.');
          analysis.skipped.forEach(f => console.log(`   • ${f}`));
        }

        console.log('\n' + '='.repeat(60));
        console.log('\n✅ Nothing to sync. The template has no new changes for your project.');
        if (analysis.projectOnlyChanges.length > 0) {
          console.log('   Your project customizations will be kept as-is.');
        }
        this.rl.close();
        return;
      }

      // Step 6: Prompt user for choice (unless auto mode or dry-run)
      let mode: SyncMode;
      let conflictResolutions: ConflictResolutionMap = {};

      if (this.options.dryRun) {
        // In dry-run, show analysis but don't apply
        mode = 'all'; // Show everything
        const result = await this.syncFiles(analysis, mode);
        this.printResults(result);
        console.log('\n🔍 DRY RUN - No changes were actually applied.');
        this.rl.close();
        return;
      } else if (this.options.autoMode !== 'none') {
        // Auto mode: apply based on the specific auto flag
        const autoModeLabels: Record<AutoMode, string> = {
          'none': '',
          'safe-only': 'AUTO SAFE ONLY - Applying only safe changes, skipping conflicts...',
          'merge-conflicts': 'AUTO MERGE - Applying all changes, conflicts will need manual merge...',
          'override-conflicts': 'AUTO OVERRIDE - Applying all changes, conflicts will be overridden with template...',
          'skip-conflicts': 'AUTO SKIP - Applying safe changes, skipping all conflicts...',
        };
        console.log(`\n🤖 ${autoModeLabels[this.options.autoMode]}`);

        switch (this.options.autoMode) {
          case 'safe-only':
            mode = 'safe';
            break;
          case 'merge-conflicts':
            mode = 'all';
            for (const conflict of analysis.conflictChanges) {
              conflictResolutions[conflict.path] = 'merge';
            }
            break;
          case 'override-conflicts':
            mode = 'all';
            for (const conflict of analysis.conflictChanges) {
              conflictResolutions[conflict.path] = 'override';
            }
            break;
          case 'skip-conflicts':
            mode = 'all';
            for (const conflict of analysis.conflictChanges) {
              conflictResolutions[conflict.path] = 'skip';
            }
            break;
          default:
            mode = 'safe';
        }
      } else {
        // Interactive mode: ask user
        mode = await this.promptUser(analysis);

        // If user chose 'all' and there are conflicts, handle them interactively
        if (mode === 'all' && analysis.conflictChanges.length > 0) {
          conflictResolutions = await this.handleConflictResolution(analysis.conflictChanges);
          this.printConflictResolutionSummary(conflictResolutions);

          // Confirm before proceeding
          let proceed: boolean;
          if (isInteractive()) {
            proceed = await confirm('Proceed with these actions?', true);
          } else {
            proceed = await new Promise<boolean>((resolve) => {
              this.rl.question('Proceed with these actions? (y/n): ', (answer) => {
                resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
              });
            });
          }

          if (!proceed) {
            console.log('\n✅ No changes applied.');
            this.rl.close();
            return;
          }
        }
      }

      this.rl.close();

      if (mode === 'none') {
        console.log('\n✅ No changes applied.');
        return;
      }

      // Step 7: Apply changes based on mode (mode is 'safe' or 'all' here)
      const result = await this.syncFiles(analysis, mode, conflictResolutions);

      // Step 8: Print results
      this.printResults(result);

      // Step 9: Auto-commit synced files and update config (only if not dry-run and changes were made)
      // Get template commits for the commit message and report (before cleanup)
      const templateCommitsForReport = this.getTemplateCommitsSinceLastSync();
      
      if (!this.options.dryRun && result.autoMerged.length > 0) {
        this.log('\n📦 Committing synced files...');
        
        if (templateCommitsForReport.length > 0 && !this.options.quiet) {
          this.log(`\n📜 Template commits being synced (${templateCommitsForReport.length}):\n`);
          templateCommitsForReport.forEach((c, i) => {
            const indented = c.split('\n').map(line => `   ${line}`).join('\n');
            this.log(indented);
            if (i < templateCommitsForReport.length - 1) {
              this.log('');
            }
          });
        }
        
        try {
          // Stage all changes (including .template-sync.json which we'll update)
          this.exec('git add -A', { silent: true });
          
          // Create commit with template commits in message
          const commitMessage = this.formatSyncCommitMessage(templateCommit, templateCommitsForReport);
          // Use a temp file for multi-line commit message
          const tempFile = path.join(this.projectRoot, '.sync-commit-msg.tmp');
          fs.writeFileSync(tempFile, commitMessage, 'utf-8');
          this.exec(`git commit -F "${tempFile}"`, { silent: true });
          fs.unlinkSync(tempFile);
          
          // Now get the commit that INCLUDES the sync changes
          const projectCommit = this.exec('git rev-parse HEAD', { silent: true });
          
          // Add to sync history
          this.addSyncHistoryEntry(templateCommit, projectCommit, result, templateCommitsForReport);
          
          this.config.lastSyncCommit = templateCommit;
          this.config.lastProjectCommit = projectCommit;
          this.config.lastSyncDate = new Date().toISOString();
          this.saveConfig();
          
          // Amend commit to include updated config
          this.exec('git add .template-sync.json', { silent: true });
          this.exec('git commit --amend --no-edit', { silent: true });
          
          const finalCommit = this.exec('git rev-parse --short HEAD', { silent: true });
          this.log(`\n   ✅ Committed as ${finalCommit}`);
        } catch (error: any) {
          this.log(`   ⚠️  Auto-commit failed: ${error.message}`);
          this.log('   Please commit the changes manually.');
          
          // Still update config even if commit fails
          this.config.lastSyncCommit = templateCommit;
          this.config.lastSyncDate = new Date().toISOString();
          this.saveConfig();
        }
      } else if (!this.options.dryRun) {
        // No changes applied, just update the sync timestamp
        this.config.lastSyncCommit = templateCommit;
        this.config.lastSyncDate = new Date().toISOString();
        this.saveConfig();
      }

      // Generate sync report if requested
      if (this.options.report && result.autoMerged.length > 0) {
        this.generateSyncReport(result, templateCommit, templateCommitsForReport);
      }

      if (result.autoMerged.length > 0) {
        this.log('\n✅ Template sync completed!');
        if (result.conflicts.length === 0) {
          this.log('   All changes were applied and committed.');
        } else {
          this.log('   Safe changes committed. Review .template files for manual merges.');
        }
      }

      // Run validation if requested
      if (this.options.validate && result.autoMerged.length > 0) {
        await this.runValidation();
      }
    } catch (error: any) {
      this.rl.close();
      throw error;
    } finally {
      // Cleanup
      this.cleanupTemplate();
    }
  }
}

// Main execution
const args = process.argv.slice(2);

// Parse auto mode flags (mutually exclusive)
let autoMode: AutoMode = 'none';
if (args.includes('--auto-safe-only')) {
  autoMode = 'safe-only';
} else if (args.includes('--auto-merge-conflicts')) {
  autoMode = 'merge-conflicts';
} else if (args.includes('--auto-override-conflicts')) {
  autoMode = 'override-conflicts';
} else if (args.includes('--auto-skip-conflicts')) {
  autoMode = 'skip-conflicts';
}

const options: SyncOptions = {
  dryRun: args.includes('--dry-run'),
  force: args.includes('--force'),
  autoMode,
  diffSummary: args.includes('--diff-summary'),
  changelog: args.includes('--changelog'),
  validate: args.includes('--validate'),
  report: args.includes('--report'),
  quiet: args.includes('--quiet'),
  verbose: args.includes('--verbose'),
};

const tool = new TemplateSyncTool(options);
tool.run().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

