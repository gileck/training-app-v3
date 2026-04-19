#!/usr/bin/env tsx
/**
 * init-mcp — scaffold an SDK + MCP server pair for the current project.
 *
 * Usage:
 *   yarn init:mcp [name]
 *
 * If `name` is omitted, defaults to the project's app name (from
 * src/app.config.js) or the folder name. Produces:
 *   packages/<name>-sdk/    — typed client for @<name>/sdk
 *   packages/<name>-mcp/    — MCP server exposing the SDK as tools
 *
 * Both packages are created from the templates under init-mcp-templates/
 * with __NAME__ / __PASCAL__ / __UPPER__ substituted. Idempotent: re-runs
 * skip any file that already exists.
 */

import * as fs from 'fs';
import * as path from 'path';

interface NameVariants {
  /** lowercase-hyphen, e.g. "training-app" */
  name: string;
  /** PascalCase, e.g. "TrainingApp" */
  pascal: string;
  /** SCREAMING_SNAKE_CASE, e.g. "TRAINING_APP" */
  upper: string;
}

function toVariants(raw: string): NameVariants {
  const name = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!name) throw new Error(`Invalid name: "${raw}"`);
  const pascal = name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  const upper = name.toUpperCase().replace(/-/g, '_');
  return { name, pascal, upper };
}

function substitute(content: string, v: NameVariants): string {
  return content
    .replace(/__PASCAL__/g, v.pascal)
    .replace(/__UPPER__/g, v.upper)
    .replace(/__NAME__/g, v.name);
}

function copyTree(srcDir: string, destDir: string, v: NameVariants, created: string[]) {
  if (!fs.existsSync(srcDir)) throw new Error(`Template dir missing: ${srcDir}`);
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyTree(srcPath, destPath, v, created);
    } else if (entry.isFile()) {
      if (fs.existsSync(destPath)) {
        console.log(`  skip (exists): ${path.relative(process.cwd(), destPath)}`);
        continue;
      }
      const raw = fs.readFileSync(srcPath, 'utf-8');
      fs.writeFileSync(destPath, substitute(raw, v), 'utf-8');
      created.push(path.relative(process.cwd(), destPath));
    }
  }
}

function defaultName(): string {
  const cfgPath = path.resolve(process.cwd(), 'src', 'app.config.js');
  if (fs.existsSync(cfgPath)) {
    const match = fs.readFileSync(cfgPath, 'utf-8').match(/appName:\s*['"]([^'"]+)['"]/);
    if (match) return match[1];
  }
  return path.basename(process.cwd());
}

function ensureTsconfigExcludes() {
  const tsconfigPath = path.resolve(process.cwd(), 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) return;
  const raw = fs.readFileSync(tsconfigPath, 'utf-8');

  // Parse; bail out if the file isn't valid JSON (the consumer may use JSONC
  // with comments — we refuse to guess).
  let parsed: { exclude?: unknown };
  try {
    parsed = JSON.parse(raw) as { exclude?: unknown };
  } catch {
    console.log('  skip tsconfig.json update: not plain JSON — add "packages/**" to "exclude" manually');
    return;
  }

  const needed = ['packages/**'];
  const existing = Array.isArray(parsed.exclude) ? (parsed.exclude as string[]) : [];
  const missing = needed.filter((x) => !existing.includes(x));
  if (missing.length === 0) return;

  const updated = { ...parsed, exclude: [...existing, ...missing] };
  fs.writeFileSync(tsconfigPath, JSON.stringify(updated, null, 2) + '\n', 'utf-8');
  console.log(`  updated tsconfig.json exclude (+${missing.length})`);
}

function ensureGitignore(v: NameVariants) {
  const gitignorePath = path.resolve(process.cwd(), '.gitignore');
  const needed = ['packages/**/node_modules', 'packages/**/dist'];
  let content = '';
  if (fs.existsSync(gitignorePath)) content = fs.readFileSync(gitignorePath, 'utf-8');
  const missing = needed.filter((line) => !content.split(/\r?\n/).includes(line));
  if (missing.length === 0) return;
  const suffix = content.endsWith('\n') || content.length === 0 ? '' : '\n';
  const block = `\n# MCP/SDK packages (scaffolded by init:mcp)\n${missing.join('\n')}\n`;
  fs.writeFileSync(gitignorePath, content + suffix + block, 'utf-8');
  console.log(`  updated .gitignore (+${missing.length} rules)`);
  // v is unused here, but kept in signature for future extension hooks
  void v;
}

function main() {
  const argv = process.argv.slice(2);
  const rawName = argv[0] ?? defaultName();
  const v = toVariants(rawName);

  console.log(`🚀 Scaffolding SDK + MCP for "${v.name}"`);
  console.log(`   pascal: ${v.pascal}`);
  console.log(`   upper:  ${v.upper}`);
  console.log('');

  const templatesDir = path.resolve(__dirname, 'init-mcp-templates');
  const packagesDir = path.resolve(process.cwd(), 'packages');
  fs.mkdirSync(packagesDir, { recursive: true });

  const sdkDest = path.join(packagesDir, `${v.name}-sdk`);
  const mcpDest = path.join(packagesDir, `${v.name}-mcp`);
  fs.mkdirSync(sdkDest, { recursive: true });
  fs.mkdirSync(mcpDest, { recursive: true });

  const created: string[] = [];

  console.log(`📦 packages/${v.name}-sdk/`);
  copyTree(path.join(templatesDir, 'sdk'), sdkDest, v, created);

  console.log(`📦 packages/${v.name}-mcp/`);
  // Copy mcp/ excluding the skills dir (we place it under use-<name>/).
  for (const entry of fs.readdirSync(path.join(templatesDir, 'mcp'), { withFileTypes: true })) {
    if (entry.name === 'skills') continue;
    const src = path.join(templatesDir, 'mcp', entry.name);
    const dst = path.join(mcpDest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(dst, { recursive: true });
      copyTree(src, dst, v, created);
    } else if (entry.isFile()) {
      if (fs.existsSync(dst)) {
        console.log(`  skip (exists): ${path.relative(process.cwd(), dst)}`);
        continue;
      }
      fs.writeFileSync(dst, substitute(fs.readFileSync(src, 'utf-8'), v), 'utf-8');
      created.push(path.relative(process.cwd(), dst));
    }
  }

  console.log(`📚 packages/${v.name}-mcp/skills/use-${v.name}/`);
  const skillDest = path.join(mcpDest, 'skills', `use-${v.name}`);
  fs.mkdirSync(skillDest, { recursive: true });
  const skillSrc = path.join(templatesDir, 'mcp', 'skills', 'SKILL.md');
  const skillPath = path.join(skillDest, 'SKILL.md');
  if (fs.existsSync(skillPath)) {
    console.log(`  skip (exists): ${path.relative(process.cwd(), skillPath)}`);
  } else {
    fs.writeFileSync(skillPath, substitute(fs.readFileSync(skillSrc, 'utf-8'), v), 'utf-8');
    created.push(path.relative(process.cwd(), skillPath));
  }

  ensureGitignore(v);
  ensureTsconfigExcludes();

  console.log('');
  if (created.length === 0) {
    console.log('✅ Nothing to do — scaffold already in place.');
  } else {
    console.log(`✅ Created ${created.length} file(s):`);
    for (const f of created) console.log(`   ${f}`);
  }

  console.log('');
  console.log('Next steps:');
  console.log(`  1. cd packages/${v.name}-sdk && yarn install && yarn build`);
  console.log(`  2. cd packages/${v.name}-mcp && yarn install && yarn build`);
  console.log(`  3. Set ADMIN_API_TOKEN on the server (vercel env).`);
  console.log(`  4. Wire the MCP into .mcp.json (see docs/template/mcp-sdk-access.md).`);
}

try {
  main();
} catch (err) {
  console.error(`❌ ${(err as Error).message || err}`);
  process.exit(1);
}
