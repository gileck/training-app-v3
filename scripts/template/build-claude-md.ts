#!/usr/bin/env tsx

// Build CLAUDE.md from docs with frontmatter
//
// Reads CLAUDE.config.yaml for global settings
// Scans docs folders for .md files with frontmatter
// Generates CLAUDE.md sorted by priority

import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';

// Types
interface Config {
  header: string;
  docs_paths: string[];
  skills_paths: string[];
  default_priority: number;
}

interface DocFrontmatter {
  title: string;
  description?: string; // What this doc is about and when to use it
  summary: string; // Key information/content summary
  priority?: number;
  key_points?: string[];
  related_docs?: string[];
  related_rules?: string[];
}

interface DocEntry extends DocFrontmatter {
  file_path: string;
  source: 'template' | 'project';
  type: 'doc' | 'skill'; // Whether this is a doc or a skill-only entry
  folder?: string; // Nested folder name (e.g., 'github-agents-workflow'), undefined for root docs
}

// Load config (wrap in frontmatter delimiters for gray-matter)
function loadConfig(configPath: string): Config {
  const content = fs.readFileSync(configPath, 'utf-8');
  // gray-matter expects frontmatter format, so wrap content
  const wrapped = `---\n${content}\n---`;
  const { data } = matter(wrapped);
  return data as Config;
}

// Scan directory for .md files (recursive)
// basePath is the root docs directory (e.g., 'docs/template')
// currentPath is the current directory being scanned
function scanDocs(basePath: string, currentPath: string, source: 'template' | 'project'): DocEntry[] {
  const entries: DocEntry[] = [];

  if (!fs.existsSync(currentPath)) {
    return entries;
  }

  const items = fs.readdirSync(currentPath);

  for (const item of items) {
    // Skip _ prefixed files, but allow _custom folder
    if (item.startsWith('_') && item !== '_custom') continue;

    const itemPath = path.join(currentPath, item);
    const stat = fs.statSync(itemPath);

    // Recursively scan subdirectories
    if (stat.isDirectory()) {
      const subEntries = scanDocs(basePath, itemPath, source);
      entries.push(...subEntries);
      continue;
    }

    if (!item.endsWith('.md')) continue;

    try {
      const content = fs.readFileSync(itemPath, 'utf-8');
      const { data } = matter(content);

      // Skip files without required frontmatter (silent - they're not meant for CLAUDE.md)
      if (!data.title || !data.summary) {
        continue;
      }

      // Calculate folder relative to base path
      const relativePath = path.relative(basePath, currentPath);
      // If relativePath is empty or '.', it's a root doc; otherwise it's the folder name
      // For nested folders like 'github-agents-workflow', use the first segment
      const folder = relativePath && relativePath !== '.'
        ? relativePath.split(path.sep)[0]
        : undefined;

      entries.push({
        title: data.title,
        description: data.description,
        summary: data.summary,
        priority: data.priority,
        key_points: data.key_points,
        related_docs: data.related_docs,
        related_rules: data.related_rules,
        file_path: itemPath,
        source,
        type: 'doc',
        folder,
      });
    } catch (err) {
      // Skip files with parse errors
      console.warn(`Skipping ${itemPath}: parse error`);
    }
  }

  return entries;
}

// Scan skills directory for SKILL.md files with title/summary
function scanSkills(dirPath: string, source: 'template' | 'project'): DocEntry[] {
  const entries: DocEntry[] = [];

  if (!fs.existsSync(dirPath)) {
    return entries;
  }

  const skillDirs = fs.readdirSync(dirPath);

  for (const skillDir of skillDirs) {
    const skillPath = path.join(dirPath, skillDir, 'SKILL.md');

    if (!fs.existsSync(skillPath)) continue;

    try {
      const content = fs.readFileSync(skillPath, 'utf-8');
      const { data } = matter(content);

      // Skip skills without title/summary (not meant for CLAUDE.md)
      if (!data.title || !data.summary) {
        continue;
      }

      entries.push({
        title: data.title,
        description: data.description,
        summary: data.summary,
        priority: data.priority,
        key_points: data.key_points,
        related_docs: data.related_docs,
        related_rules: data.related_rules,
        file_path: skillPath,
        source,
        type: 'skill',
      });
    } catch (err) {
      // Skip files with YAML parse errors
      console.warn(`Skipping ${skillPath}: YAML parse error`);
    }
  }

  return entries;
}

// Helper to create relative link
function relLink(filePath: string): string {
  return `[${path.basename(filePath)}](${filePath})`;
}

// Helper to create doc link - resolves relative paths
function resolveDocPath(relativePath: string, currentDocPath: string): string {
  const dir = path.dirname(currentDocPath);
  return path.join(dir, relativePath);
}

// Generate a single section
function generateSection(entry: DocEntry): string {
  const lines: string[] = [];

  // Section header
  lines.push(`## ${entry.title}`);
  lines.push('');

  // Description (what this doc is about, when to use)
  if (entry.description) {
    lines.push(entry.description);
    lines.push('');
  }

  // Summary (key information)
  lines.push(`**Summary:** ${entry.summary}`);
  lines.push('');

  // Key points (if any)
  if (entry.key_points && entry.key_points.length > 0) {
    lines.push('**Key Points:**');
    for (const point of entry.key_points) {
      lines.push(`- ${point}`);
    }
    lines.push('');
  }

  // Links section
  const linkParts: string[] = [];

  if (entry.type === 'doc') {
    // For docs: show Docs link + related docs
    const docLinks = [relLink(entry.file_path)];
    if (entry.related_docs) {
      for (const relDoc of entry.related_docs) {
        const resolved = resolveDocPath(relDoc, entry.file_path);
        docLinks.push(relLink(resolved));
      }
    }
    linkParts.push(`**Docs:** ${docLinks.join(', ')}`);

    // Rules (resolve from skills folder)
    if (entry.related_rules && entry.related_rules.length > 0) {
      const ruleLinks = entry.related_rules.map(rule => {
        const skillPath = `.ai/skills/${entry.source}/${rule}/SKILL.md`;
        return `[${rule}](${skillPath})`;
      });
      linkParts.push(`**Rules:** ${ruleLinks.join(', ')}`);
    }
  } else {
    // For skills: show Rules link only
    linkParts.push(`**Rules:** [${path.basename(path.dirname(entry.file_path))}](${entry.file_path})`);
  }

  lines.push(linkParts.join('\n'));
  lines.push('');
  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

// Main build function
function buildClaudeMd(config: Config): string {
  const allEntries: DocEntry[] = [];

  // Scan docs
  for (const docsPath of config.docs_paths) {
    const source = docsPath.includes('project') ? 'project' : 'template';
    const entries = scanDocs(docsPath, docsPath, source as 'template' | 'project');
    allEntries.push(...entries);
  }

  // Scan skills
  for (const skillsPath of config.skills_paths) {
    const source = skillsPath.includes('project') ? 'project' : 'template';
    const entries = scanSkills(skillsPath, source as 'template' | 'project');
    allEntries.push(...entries);
  }

  // Sort by priority (lower = higher priority), then by title
  const defaultPriority = config.default_priority || 3;
  allEntries.sort((a, b) => {
    const priorityA = a.priority ?? defaultPriority;
    const priorityB = b.priority ?? defaultPriority;
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    return a.title.localeCompare(b.title);
  });

  // Group entries: root docs first, then grouped by folder
  const rootEntries = allEntries.filter(e => !e.folder);
  const folderEntries = allEntries.filter(e => e.folder);

  // Get unique folders in order of first appearance (by priority)
  const folders: string[] = [];
  for (const entry of folderEntries) {
    if (entry.folder && !folders.includes(entry.folder)) {
      folders.push(entry.folder);
    }
  }

  // Generate output
  const sections: string[] = [config.header, ''];

  // Root docs first
  for (const entry of rootEntries) {
    sections.push(generateSection(entry));
  }

  // Then folder groups
  for (const folder of folders) {
    const folderDocs = folderEntries.filter(e => e.folder === folder);
    if (folderDocs.length === 0) continue;

    // Add folder header
    sections.push(`# ${folder}\n`);

    for (const entry of folderDocs) {
      sections.push(generateSection(entry));
    }
  }

  return sections.join('\n');
}

// Run
const configPath = 'CLAUDE.config.yaml';
const outputPath = process.argv[2] || 'CLAUDE_TEST.md';

if (!fs.existsSync(configPath)) {
  console.error(`Config file not found: ${configPath}`);
  process.exit(1);
}

const config = loadConfig(configPath);
const content = buildClaudeMd(config);

fs.writeFileSync(outputPath, content);
console.log(`Generated ${outputPath}`);
