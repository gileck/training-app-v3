#!/usr/bin/env tsx

/**
 * Merge Template Files Script
 * 
 * This script helps merge specific files from the template repository into your project.
 * 
 * Usage:
 *   yarn merge-template <file1> [file2] [file3] ...
 * 
 * Examples:
 *   yarn merge-template docs/theming.md
 *   yarn merge-template src/client/config/defaults.ts src/apis/apis.ts
 * 
 * Options:
 *   --dry-run      Show what would be done without making changes
 *   --use-https    Use HTTPS instead of SSH for cloning
 *   --no-cleanup   Keep temp template directory after completion
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { select, isInteractive, SelectOption } from './cli-utils';
import * as readline from 'readline';

interface TemplateSyncConfig {
  templateRepo: string;
  templateBranch: string;
  lastSyncCommit: string | null;
  ignoredFiles: string[];
  projectSpecificFiles: string[];
}

type MergeAction = 'template' | 'keep' | 'merge' | 'diff' | 'skip';

interface FileStatus {
  path: string;
  inTemplate: boolean;
  inProject: boolean;
  identical: boolean;
  templateContent?: string;
  projectContent?: string;
}

const CONFIG_FILE = '.template-sync.json';
const TEMPLATE_DIR = '.template-sync-temp';

class MergeTemplateFiles {
  private config: TemplateSyncConfig;
  private projectRoot: string;
  private dryRun: boolean;
  private useHTTPS: boolean;
  private noCleanup: boolean;
  private rl: readline.Interface;

  constructor(options: { dryRun: boolean; useHTTPS: boolean; noCleanup: boolean }) {
    this.projectRoot = process.cwd();
    this.dryRun = options.dryRun;
    this.useHTTPS = options.useHTTPS;
    this.noCleanup = options.noCleanup;
    this.config = this.loadConfig();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
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

  private exec(command: string, options: { cwd?: string; silent?: boolean } = {}): string {
    try {
      return execSync(command, {
        cwd: options.cwd || this.projectRoot,
        encoding: 'utf-8',
        stdio: options.silent ? 'pipe' : 'inherit',
      }).toString().trim();
    } catch (error: unknown) {
      if (!options.silent) {
        throw error;
      }
      return '';
    }
  }

  private convertToSSH(url: string): string {
    if (url.startsWith('git@')) {
      return url;
    }

    const httpsMatch = url.match(/^https?:\/\/([^/]+)\/(.+)$/);
    if (httpsMatch) {
      const [, host, pathPart] = httpsMatch;
      return `git@${host}:${pathPart}`;
    }

    return url;
  }

  private getRepoUrl(): string {
    const baseUrl = this.config.templateRepo;
    
    if (this.useHTTPS) {
      return baseUrl;
    }
    
    return this.convertToSSH(baseUrl);
  }

  private cloneTemplate(): void {
    const templatePath = path.join(this.projectRoot, TEMPLATE_DIR);

    if (fs.existsSync(templatePath)) {
      console.log('📦 Using existing template directory...');
      return;
    }

    const repoUrl = this.getRepoUrl();
    console.log(`📥 Cloning template from ${repoUrl}...`);
    this.exec(
      `git clone --branch ${this.config.templateBranch} --depth 1 ${repoUrl} ${TEMPLATE_DIR}`,
      { silent: true }
    );
  }

  private cleanupTemplate(): void {
    if (this.noCleanup) {
      console.log('📁 Template directory kept at:', TEMPLATE_DIR);
      return;
    }

    const templatePath = path.join(this.projectRoot, TEMPLATE_DIR);
    if (fs.existsSync(templatePath)) {
      fs.rmSync(templatePath, { recursive: true, force: true });
    }
  }

  private getFileHash(filePath: string): string {
    if (!fs.existsSync(filePath)) return '';

    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  }

  private getFileStatus(filePath: string): FileStatus {
    const templatePath = path.join(this.projectRoot, TEMPLATE_DIR);
    const templateFilePath = path.join(templatePath, filePath);
    const projectFilePath = path.join(this.projectRoot, filePath);

    const inTemplate = fs.existsSync(templateFilePath);
    const inProject = fs.existsSync(projectFilePath);

    let identical = false;
    let templateContent: string | undefined;
    let projectContent: string | undefined;

    if (inTemplate) {
      templateContent = fs.readFileSync(templateFilePath, 'utf-8');
    }
    if (inProject) {
      projectContent = fs.readFileSync(projectFilePath, 'utf-8');
    }

    if (inTemplate && inProject) {
      const templateHash = this.getFileHash(templateFilePath);
      const projectHash = this.getFileHash(projectFilePath);
      identical = templateHash === projectHash;
    }

    return {
      path: filePath,
      inTemplate,
      inProject,
      identical,
      templateContent,
      projectContent,
    };
  }

  private generateDiff(filePath: string): string {
    const templatePath = path.join(this.projectRoot, TEMPLATE_DIR);
    const templateFilePath = path.join(templatePath, filePath);
    const projectFilePath = path.join(this.projectRoot, filePath);

    const templateExists = fs.existsSync(templateFilePath);
    const projectExists = fs.existsSync(projectFilePath);

    if (!templateExists && !projectExists) {
      return '(file does not exist in either location)';
    }

    if (!templateExists) {
      return '(file only exists in project, not in template)';
    }

    if (!projectExists) {
      const content = fs.readFileSync(templateFilePath, 'utf-8');
      const lines = content.split('\n').length;
      return `+++ NEW FILE (${lines} lines) +++\n${content}`;
    }

    try {
      const diff = this.exec(
        `diff -u "${projectFilePath}" "${templateFilePath}" || true`,
        { silent: true }
      );

      if (!diff.trim()) {
        return '(files are identical)';
      }

      return diff
        .replace(projectFilePath, `a/${filePath} (project)`)
        .replace(templateFilePath, `b/${filePath} (template)`);
    } catch {
      return '(unable to generate diff)';
    }
  }

  private getDiffStats(filePath: string): { added: number; removed: number } {
    const diff = this.generateDiff(filePath);
    const lines = diff.split('\n');
    let added = 0;
    let removed = 0;

    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        added++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        removed++;
      }
    }

    return { added, removed };
  }

  private colorDiff(diff: string): string {
    return diff
      .split('\n')
      .map(line => {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          return `\x1b[32m${line}\x1b[0m`; // Green for additions
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          return `\x1b[31m${line}\x1b[0m`; // Red for removals
        } else if (line.startsWith('@@')) {
          return `\x1b[36m${line}\x1b[0m`; // Cyan for line numbers
        }
        return line;
      })
      .join('\n');
  }

  private async promptAction(filePath: string, status: FileStatus): Promise<MergeAction> {
    const options: SelectOption<MergeAction>[] = [];

    if (status.inTemplate) {
      options.push({
        value: 'template' as MergeAction,
        label: 'Take template version',
        description: 'Replace project file with template version',
      });
    }

    if (status.inProject) {
      options.push({
        value: 'keep' as MergeAction,
        label: 'Keep project version',
        description: 'Keep your current file unchanged',
      });
    }

    if (status.inTemplate && status.inProject) {
      options.push({
        value: 'merge' as MergeAction,
        label: 'Create merge file',
        description: 'Save template version as .template for manual merge',
      });
    }

    options.push({
      value: 'diff' as MergeAction,
      label: 'View full diff',
      description: 'Show complete diff before deciding',
    });

    options.push({
      value: 'skip' as MergeAction,
      label: 'Skip for now',
      description: 'Move to next file without changes',
    });

    if (isInteractive()) {
      const result = await select(`Choose action for ${path.basename(filePath)}:`, options);
      return result ?? 'skip';
    } else {
      // Fallback for non-TTY
      console.log('\nChoose action:');
      options.forEach((opt, i) => {
        console.log(`  [${i + 1}] ${opt.label} - ${opt.description}`);
      });

      return new Promise((resolve) => {
        this.rl.question('Enter choice: ', (answer) => {
          const index = parseInt(answer.trim()) - 1;
          if (index >= 0 && index < options.length) {
            resolve(options[index].value);
          } else {
            resolve('skip');
          }
        });
      });
    }
  }

  private applyAction(filePath: string, action: MergeAction, status: FileStatus): void {
    const templatePath = path.join(this.projectRoot, TEMPLATE_DIR);
    const templateFilePath = path.join(templatePath, filePath);
    const projectFilePath = path.join(this.projectRoot, filePath);

    switch (action) {
      case 'template':
        if (this.dryRun) {
          console.log(`   [DRY-RUN] Would copy template version to ${filePath}`);
        } else {
          const dir = path.dirname(projectFilePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.copyFileSync(templateFilePath, projectFilePath);
          console.log(`   ✅ Copied template version to ${filePath}`);
        }
        break;

      case 'keep':
        console.log(`   ✅ Kept project version of ${filePath}`);
        break;

      case 'merge':
        if (this.dryRun) {
          console.log(`   [DRY-RUN] Would create ${filePath}.template`);
        } else {
          fs.copyFileSync(templateFilePath, projectFilePath + '.template');
          console.log(`   ✅ Created ${filePath}.template for manual merge`);
          console.log(`      Compare with: diff ${filePath} ${filePath}.template`);
        }
        break;

      case 'skip':
        console.log(`   ⏭️  Skipped ${filePath}`);
        break;
    }
  }

  async run(filePatterns: string[]): Promise<void> {
    if (filePatterns.length === 0) {
      console.error('❌ Error: No files specified.');
      console.error('Usage: yarn merge-template <file1> [file2] ...');
      console.error('Example: yarn merge-template docs/theming.md src/apis/apis.ts');
      process.exit(1);
    }

    console.log('🔀 Merge Template Files');
    console.log('═'.repeat(60));

    if (this.dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made\n');
    }

    // Clone template
    this.cloneTemplate();

    try {
      // Use file patterns directly (no glob expansion)
      const files = [...new Set(filePatterns)]; // Remove duplicates

      console.log(`\n📋 Processing ${files.length} file(s)...\n`);

      const results = {
        template: [] as string[],
        kept: [] as string[],
        merged: [] as string[],
        skipped: [] as string[],
        notFound: [] as string[],
      };

      for (let i = 0; i < files.length; i++) {
        const filePath = files[i];
        console.log('─'.repeat(60));
        console.log(`\n📄 File ${i + 1} of ${files.length}: \x1b[1m${filePath}\x1b[0m\n`);

        const status = this.getFileStatus(filePath);

        // Handle edge cases
        if (!status.inTemplate && !status.inProject) {
          console.log('   ❌ File not found in template or project');
          results.notFound.push(filePath);
          continue;
        }

        if (!status.inTemplate) {
          console.log('   ⚠️  File only exists in project (not in template)');
          console.log('   Nothing to merge from template.');
          results.skipped.push(filePath);
          continue;
        }

        if (status.identical) {
          console.log('   ✅ Files are identical - no action needed');
          results.skipped.push(filePath);
          continue;
        }

        // Show diff stats
        const stats = this.getDiffStats(filePath);
        if (status.inProject) {
          console.log(`   📊 Changes: \x1b[32m+${stats.added}\x1b[0m lines, \x1b[31m-${stats.removed}\x1b[0m lines`);
        } else {
          console.log(`   📊 New file from template (${status.templateContent?.split('\n').length || 0} lines)`);
        }

        // Prompt for action (loop to allow viewing diff)
        let action: MergeAction;
        do {
          action = await this.promptAction(filePath, status);

          if (action === 'diff') {
            console.log('\n' + '─'.repeat(60));
            console.log('📝 DIFF OUTPUT:');
            console.log('─'.repeat(60));
            console.log(this.colorDiff(this.generateDiff(filePath)));
            console.log('─'.repeat(60) + '\n');
          }
        } while (action === 'diff');

        // Apply the chosen action
        this.applyAction(filePath, action, status);

        // Track results
        switch (action) {
          case 'template':
            results.template.push(filePath);
            break;
          case 'keep':
            results.kept.push(filePath);
            break;
          case 'merge':
            results.merged.push(filePath);
            break;
          case 'skip':
            results.skipped.push(filePath);
            break;
        }
      }

      // Summary
      console.log('\n' + '═'.repeat(60));
      console.log('📊 SUMMARY');
      console.log('═'.repeat(60));

      if (results.template.length > 0) {
        console.log(`\n✅ Copied from template (${results.template.length}):`);
        results.template.forEach(f => console.log(`   • ${f}`));
      }

      if (results.merged.length > 0) {
        console.log(`\n🔀 Created .template files (${results.merged.length}):`);
        results.merged.forEach(f => console.log(`   • ${f}.template`));
      }

      if (results.kept.length > 0) {
        console.log(`\n📁 Kept project version (${results.kept.length}):`);
        results.kept.forEach(f => console.log(`   • ${f}`));
      }

      if (results.skipped.length > 0) {
        console.log(`\n⏭️  Skipped (${results.skipped.length}):`);
        results.skipped.forEach(f => console.log(`   • ${f}`));
      }

      if (results.notFound.length > 0) {
        console.log(`\n❌ Not found (${results.notFound.length}):`);
        results.notFound.forEach(f => console.log(`   • ${f}`));
      }

      console.log('\n' + '═'.repeat(60));

      if (results.merged.length > 0) {
        console.log('\n💡 Next steps for .template files:');
        console.log('   1. Compare: diff <file> <file>.template');
        console.log('   2. Manually merge the changes');
        console.log('   3. Delete the .template file when done');
      }

      if (results.template.length > 0 && !this.dryRun) {
        console.log('\n💡 Don\'t forget to commit your changes!');
      }

    } finally {
      this.rl.close();
      this.cleanupTemplate();
    }
  }
}

// Main execution
const args = process.argv.slice(2);

// Parse options
const options = {
  dryRun: args.includes('--dry-run'),
  useHTTPS: args.includes('--use-https'),
  noCleanup: args.includes('--no-cleanup'),
};

// Filter out options to get file paths
const filePatterns = args.filter(arg => !arg.startsWith('--'));

const tool = new MergeTemplateFiles(options);
tool.run(filePatterns).catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

