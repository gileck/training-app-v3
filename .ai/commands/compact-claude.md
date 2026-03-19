# Compact CLAUDE.md

Reduce CLAUDE.md size by converting verbose sections to concise summaries with doc references.

## Target Structure Per Section

```markdown
## Section Title

What is it. When to use it.

**Summary:** One-sentence description of the key concept or pattern.

**Key Points:** (optional, only if critical)
- Critical point 1
- Critical point 2

**Commands:** (optional) `yarn command1`, `yarn command2`

**Docs:** [doc-link](path/to/doc.md)
**Rules:** [rule-link](path/to/SKILL.md)
```

## Process

1. **Identify verbose sections** - Over 20 lines, has code examples, detailed explanations
2. **Condense to summary** - Keep only: purpose, critical points, doc/rule references
3. **Remove all code examples** - Detailed examples belong in referenced docs
4. **Remove tables** - Unless essential for quick reference
5. **Verify doc references** - Ensure all referenced docs exist

## Guidelines

**Keep in CLAUDE.md:**
- Section title and one-line description
- "When to use" context
- Critical warnings (CRITICAL:, NEVER:, ALWAYS:)
- Essential commands
- Doc/Rules references

**Move to docs:**
- Code examples
- Step-by-step instructions
- Detailed explanations
- Tables with many rows
- Edge cases and troubleshooting

## Verification

After compacting, verify:
1. All doc/rule links are valid
2. No critical information was lost
3. Run `yarn checks` passes

## Report

```
✨ CLAUDE.md Compaction Complete!

📊 Results:
- Original: X lines → New: Y lines (Z% reduction)

📄 Sections compacted:
1. [Section Name] - X lines → Y lines
2. [Section Name] - X lines → Y lines
```
