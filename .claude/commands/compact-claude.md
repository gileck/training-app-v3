# Compact CLAUDE.md

This command compacts CLAUDE.md by extracting long sections into dedicated documentation files while preserving all content.

## Purpose

Use this command to:
- Reduce the size of CLAUDE.md for better performance
- Extract verbose sections to dedicated docs
- Maintain all content (no deletion, just reorganization)
- Keep CLAUDE.md as a concise overview with links to detailed docs

## Process

### Step 1: Identify Long Sections

Analyze CLAUDE.md and identify sections that are:
- **Over 50 lines** of content (excluding headers)
- Contain detailed examples, code blocks, or extensive explanations
- Already have or could benefit from a dedicated doc file

Target sections typically include:
- React Rendering & Infinite Loops (has examples)
- Validation & Quality Checks (verbose planning mode instructions)
- Guidelines Compliance Checklist (long checklist)
- GitHub Projects Integration (extensive setup instructions)
- GitHub PR CLI Tool (many command examples)
- Vercel CLI Tool (many command examples)
- Critical Deployment Issues & Best Practices (multiple detailed issues)
- Template Sync (detailed flags and examples)

### Step 2: For Each Long Section

For each section identified for compaction:

1. **Create/Update Dedicated Doc**
   - Create a new doc file in `docs/` with format: `docs/{section-name-extended}.md`
   - If the section already references a doc (e.g., `docs/react-rendering-guidelines.md`), create a new extended version like `docs/react-rendering-guidelines-extended.md`
   - Include the full original content from CLAUDE.md
   - Add a header explaining this is the detailed version
   - Add a note at the bottom linking back to CLAUDE.md

2. **Replace in CLAUDE.md**
   - Keep the section header (## Section Name)
   - Write a concise summary (15-30 lines max) that includes:
     - One-sentence purpose
     - **Critical** points only (use **CRITICAL:** or **Key Points:** bullets)
     - One minimal code example if essential
     - Link to the detailed doc(s)
     - Link to any existing related docs
   - Maintain the same formatting style as other sections

### Step 3: Create Backup

Before making changes:
```bash
cp CLAUDE.md CLAUDE.md.backup
```

### Step 4: Update CLAUDE.md

Replace each long section with its compacted version, ensuring:
- All critical information is preserved in the summary
- Links to detailed docs are clear
- Formatting is consistent with other sections
- The overall structure and flow remain intact

### Step 5: Content Verification (CRITICAL)

**IMPORTANT:** Before committing, you MUST verify that ALL removed content exists in the referenced docs. This prevents accidental loss of important information.

#### 5.1 Extract Original Content

For each section being compacted, save the original content BEFORE making changes:
```bash
# Extract original section to temp file (adjust line range as needed)
git show HEAD:CLAUDE.md | sed -n '/^## Section Name/,/^---$/p' > /tmp/original_section.md
```

#### 5.2 Content Verification Checklist

For each extracted section, verify ALL of the following:

**A. Line Count Check**
```bash
# New doc should be >= original section (content + headers/navigation)
wc -l /tmp/original_section.md
wc -l docs/new-section-guide.md
```
- ✅ New doc lines >= Original section lines (accounting for added headers/navigation)
- ❌ If new doc is significantly shorter, content may be missing

**B. Key Pattern Verification**

Identify 3-5 unique, important phrases from the original section and verify they exist in the new doc:
```bash
# Example patterns to check (customize for each section)
grep -c "UNIQUE_PHRASE_1" docs/new-section-guide.md  # Should be >= 1
grep -c "UNIQUE_PHRASE_2" docs/new-section-guide.md  # Should be >= 1
grep -c "important_function_name" docs/new-section-guide.md  # Should be >= 1
```

**C. Code Block Verification**

Count code blocks in original vs new:
```bash
# Count code blocks (``` markers)
grep -c '```' /tmp/original_section.md
grep -c '```' docs/new-section-guide.md
```
- ✅ New doc should have >= same number of code blocks

**D. Table Verification (if applicable)**

If original has tables, verify all rows exist:
```bash
# Count table rows
grep -c '^\|' /tmp/original_section.md
grep -c '^\|' docs/new-section-guide.md
```

**E. Critical Warnings Verification**

Check that all CRITICAL/WARNING/IMPORTANT markers are preserved:
```bash
grep -i "critical\|warning\|important" /tmp/original_section.md
grep -i "critical\|warning\|important" docs/new-section-guide.md
```

#### 5.3 Verification Report

After all checks, provide a verification report:
```
🔍 Content Verification Report

Section: [Section Name]
Original: X lines | New Doc: Y lines ✅/❌

Key Patterns:
- "pattern 1": Found ✅
- "pattern 2": Found ✅
- "pattern 3": Found ✅

Code Blocks: Original: N | New: M ✅/❌
Tables: Original: N rows | New: M rows ✅/❌
Critical Warnings: All preserved ✅/❌

Status: VERIFIED ✅ / FAILED ❌
```

#### 5.4 Failure Handling

If ANY verification fails:
1. **DO NOT commit** the changes
2. Restore from backup: `cp CLAUDE.md.backup CLAUDE.md`
3. Fix the missing content in the new doc
4. Re-run verification
5. Only proceed when ALL checks pass

### Step 6: Final Checks

After content verification passes:
1. Run `yarn checks` to ensure no TypeScript/ESLint issues
2. Verify all doc links are correct and files exist
3. Remove backup file only after successful commit

### Step 7: Report Results

Provide a summary to the user:
```
✨ CLAUDE.md Compaction Complete!

📊 Results:
- Original: X lines
- New: Y lines
- Reduction: Z% (~W lines saved)

📄 Extracted sections:
1. [Section Name] → docs/section-name.md
   - Original: X lines | New: Y lines ✅
   - Key patterns verified ✅
   - Code blocks preserved ✅

2. [Section Name] → docs/section-name-extended.md
   - Original: X lines | New: Y lines ✅
   - Key patterns verified ✅
   - Tables preserved ✅
...

🔍 Verification: ALL PASSED ✅

✅ All content preserved and verified, just reorganized for better readability.
```

## Compaction Guidelines

**DO:**
- ✅ Extract verbose examples to dedicated docs
- ✅ Keep critical warnings and rules in summary
- ✅ Preserve all doc links
- ✅ Maintain consistent formatting
- ✅ Create clear, descriptive summaries

**DON'T:**
- ❌ Delete any content
- ❌ Remove critical warnings or rules
- ❌ Break existing doc references
- ❌ Change section headers or structure
- ❌ Remove code examples that are essential for understanding

## Example Compaction

**Before (60 lines):**
```markdown
## React Rendering & Infinite Loops

[Long explanation about Zustand selectors]
[Multiple code examples with BAD and GOOD patterns]
[Detailed symptoms and debugging steps]
[Best practices with 5 different examples]
```

**After (25 lines):**
```markdown
## React Rendering & Infinite Loops

Common pitfalls that cause infinite re-renders.

**CRITICAL:** Never return `{}` or `[]` literals in Zustand selector fallbacks. Create module-level constants.

**Example:**
[One minimal bad/good comparison]

**Docs:** [docs/react-rendering-guidelines.md](docs/react-rendering-guidelines.md), [docs/react-rendering-infinite-loops-extended.md](docs/react-rendering-infinite-loops-extended.md)
```

## Notes

- This is a reorganization, not a reduction of content
- The goal is readability, not deletion
- All detailed information remains accessible via docs
- CLAUDE.md becomes a better quick reference guide
- Detailed docs serve as comprehensive references
- **CRITICAL:** Never skip the verification step - it prevents accidental content loss
- If verification fails, DO NOT commit - fix the issue first
