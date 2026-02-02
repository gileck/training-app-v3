---
number: 39
title: "Split telegram-webhook.ts into smaller modules"
priority: Medium
size: M
complexity: Medium
status: TODO
dateAdded: 2026-02-02
---

# Task 39: Split telegram-webhook.ts into smaller modules

**Summary:** Split the 3200+ line telegram-webhook.ts into multiple small files under a telegram-webhook folder for better maintainability

## Files to Modify

- `src/pages/api/telegram-webhook.ts` - Split into modules
- `src/pages/api/telegram-webhook/` - New folder for modules
- `src/pages/api/telegram-webhook/index.ts` - Main handler
- `src/pages/api/telegram-webhook/handlers/` - Action handlers
- `src/pages/api/telegram-webhook/utils/` - Helper utilities
