---
number: 32
title: "Display Design Docs and PR Links from GitHub Issue Artifacts"
priority: Medium
complexity: Medium
size: M
status: TODO
dateAdded: 2026-01-28
---

# Task 32: Display Design Docs and PR Links from GitHub Issue Artifacts

**Summary:** Extract artifact links (design docs, PRs) from GitHub issue comments and display them in the feature request page and card

## Details

Currently, the agent workflow creates "artifact" comments on GitHub issues that contain links to:
- Product design documents (`design-docs/issue-N/product-design.md`)
- Tech design documents (`design-docs/issue-N/tech-design.md`)
- Pull requests created for the issue

These artifact comments follow a specific format and are posted by the agent. We need to:
1. Parse the GitHub issue comments to extract artifact links
2. Return these links in the API response
3. Display them in the FeatureRequestDetail page and FeatureRequestCard component

## Implementation Notes

### Artifact Comment Format
The agents post comments with artifact links in a structured format. Check `src/agents/lib/artifacts.ts` for the exact format used.

### API Changes
- Modify `getGitHubIssueDetails` handler to parse comments and extract artifact links
- Add artifact links to the response type

### UI Changes
- Add a section in FeatureRequestDetail to show design doc links
- Optionally show artifact indicators in FeatureRequestCard

## Files to Modify

- `src/agents/lib/artifacts.ts` - Reference for artifact format
- `src/apis/feature-requests/handlers/getGitHubIssueDetails.ts` - Extract artifacts from comments
- `src/apis/feature-requests/types.ts` - Add artifact types to response
- `src/client/routes/FeatureRequests/FeatureRequestDetail.tsx` - Display artifact links
- `src/client/routes/FeatureRequests/components/FeatureRequestCard.tsx` - Optional: show artifact indicators

## Notes

This replaces the removed MongoDB design fields with live data from GitHub issue artifacts.
