---
title: Configuration Files (Template/Project Split)
description: Config files use a split pattern for template updates without losing project customizations. Use this when modifying ESLint, Next.js, or TypeScript configs.
summary: Template configs (synced) live in `config/*/` folders. Project configs (never synced) let you add customizations. Root configs merge both.
priority: 3
key_points:
  - "ESLint: `config/eslint/eslint.project.mjs` for project rules (ignores, custom rules)"
  - "Next.js: `config/next/next.project.ts` for project config (images, domains)"
  - "TypeScript: Add `tsconfig.json` to `projectOverrides` if you need custom excludes"
---

# Configuration Files (Template/Project Split)

This document explains how configuration files are organized to allow template updates while preserving project-specific customizations.

## Overview

Configuration files follow a **template/project split pattern**:
- **Template configs** (synced from template) - contain shared settings
- **Project configs** (never synced) - contain project-specific overrides
- **Root configs** - merge both together

## Config File Structure

```
config/
├── eslint/
│   ├── eslint.template.mjs    # Synced - template ESLint rules
│   └── eslint.project.mjs     # NOT synced - project rules
├── next/
│   ├── next.template.ts       # Synced - template Next.js config
│   └── next.project.ts        # NOT synced - project config
└── typescript/
    └── tsconfig.template.json # Synced - template TypeScript settings

# Root configs (merge template + project):
eslint.config.mjs              # Imports and spreads both ESLint configs
next.config.ts                 # Imports and merges both Next configs
tsconfig.json                  # Extends template, adds project excludes directly
```

## ESLint Configuration

**How it works:** ESLint flat config uses arrays that can be spread together.

### Template (`config/eslint/eslint.template.mjs`)
Contains template rules - synced from template:
- API guidelines rules
- State management rules
- Restricted imports
- Base Next.js rules

### Project (`config/eslint/eslint.project.mjs`)
Add project-specific rules here - never synced:
```javascript
const eslintProjectConfig = [
  // Ignore legacy code folders
  {
    ignores: ["old_v1_source/**", "legacy/**"]
  },
  // Project-specific rules
  {
    files: ["src/my-feature/**"],
    rules: {
      "some-rule": "warn"
    }
  }
];

export default eslintProjectConfig;
```

### Root (`eslint.config.mjs`)
Merges both (synced):
```javascript
import eslintTemplateConfig from "./config/eslint/eslint.template.mjs";
import eslintProjectConfig from "./config/eslint/eslint.project.mjs";

export default [...eslintTemplateConfig, ...eslintProjectConfig];
```

## Next.js Configuration

**How it works:** Next.js config is an object that gets merged.

### Template (`config/next/next.template.ts`)
Contains template config - synced:
- PWA configuration
- Webpack settings
- Rewrites

### Project (`config/next/next.project.ts`)
Add project-specific config here - never synced:
```typescript
import type { NextConfig } from "next";

export const nextProjectConfig: Partial<NextConfig> = {
  images: {
    domains: ['my-cdn.com'],
  },
  // Add other project-specific settings
};
```

### Root (`next.config.ts`)
Merges both (synced):
```typescript
import { nextTemplateConfig, withPWA, pwaConfig } from "./config/next/next.template";
import { nextProjectConfig } from "./config/next/next.project";

const mergedConfig = { ...nextTemplateConfig, ...nextProjectConfig };
export default withPWA(pwaConfig)(mergedConfig);
```

## TypeScript Configuration

**How it works:** TypeScript uses `extends` which only supports ONE base config. Arrays like `exclude` are replaced, not merged.

### Template (`config/typescript/tsconfig.template.json`)
Contains base compiler options - synced:
- Target, lib, module settings
- Strict mode settings
- Plugin settings

### Root (`tsconfig.json`)
Extends template and adds project overrides directly (synced by default):
```json
{
  "extends": "./config/typescript/tsconfig.template.json",
  "compilerOptions": {
    "paths": { "@/*": ["./src/*"] }
  },
  "exclude": ["node_modules", "old_v1_source"]
}
```

**Important:** Since TypeScript doesn't support merging multiple configs, project-specific settings go directly in `tsconfig.json`. If you need custom excludes:
1. Add `tsconfig.json` to `projectOverrides` in `.template-sync.json`
2. Modify `tsconfig.json` directly

## Adding Project Overrides

When you need to customize a synced config file:

1. **For ESLint/Next.js:** Edit the `*.project.*` file in the config folder
2. **For TypeScript:** Add `tsconfig.json` to `projectOverrides` and edit directly
3. **For any file:** Add to `projectOverrides` in `.template-sync.json`:

```json
{
  "projectOverrides": [
    "tsconfig.json",
    "src/client/components/ui/my-custom-component.tsx"
  ]
}
```

## Best Practices

1. **Never edit template configs** - They will be overwritten on sync
2. **Use project configs** - Add customizations to `*.project.*` files
3. **Use projectOverrides sparingly** - Only for files that truly need to differ from template
4. **Document overrides** - Add a comment explaining why each override is needed
