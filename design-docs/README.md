# Design Documents

This directory contains approved design documents for GitHub issues.

## Structure

```
design-docs/
├── issue-123/
│   ├── product-design.md
│   └── tech-design.md
└── issue-456/
    └── product-design.md
```

## Workflow

1. **Design agents create PRs** with design files in this directory
2. **Admin receives Telegram notification** with [Approve & Merge] / [Request Changes] buttons
3. **Approve & Merge** triggers:
   - PR merged with squash commit
   - Artifact comment posted/updated on the GitHub issue
   - Status advanced to next phase
4. **Implementation agent reads designs** from files (via artifact comment links)

## File Naming Convention

- `product-design.md` - Product Design document
- `tech-design.md` - Technical Design document

Each issue gets its own directory: `issue-{N}/`

## Artifact Comments

After a design PR is merged, an artifact comment is posted on the GitHub issue:

```markdown
<!-- ISSUE_ARTIFACT_V1 -->
## Design Documents

| Document | Status | Updated | PR |
|----------|--------|---------|-----|
| [Product Design](design-docs/issue-123/product-design.md) | ✅ Approved | 2026-01-25 | #456 |
| [Technical Design](design-docs/issue-123/tech-design.md) | ✅ Approved | 2026-01-25 | #457 |
```

## Backward Compatibility

The implementation agent falls back to reading designs from issue body if no artifact comment exists. This maintains compatibility with issues created before this workflow was implemented.
