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

### Step 5: Verify

After compacting:
1. Check that CLAUDE.md is significantly shorter
2. Verify all links to new docs are correct
3. Ensure no content was lost (just moved)
4. Run `yarn checks` to ensure no issues

### Step 6: Report Results

Provide a summary to the user:
```
✨ CLAUDE.md Compaction Complete!

📊 Results:
- Original: X lines
- New: Y lines
- Reduction: Z% (~W lines saved)

📄 Extracted sections:
1. [Section Name] → docs/section-name.md
2. [Section Name] → docs/section-name-extended.md
...

💾 Backup created: CLAUDE.md.backup

✅ All content preserved, just reorganized for better readability.
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
