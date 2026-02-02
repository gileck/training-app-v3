# Project-Specific Components

This folder is for **project-specific UI components** that are not synced from the template.

## When to Use This Folder

Use this folder when you need to:

1. **Customize a shadcn component** - Copy from `ui/`, modify here
2. **Create project-specific components** - Components unique to your project
3. **Add new shadcn components not in template** - Components the template doesn't include

## Examples

### Customizing a shadcn Component

If you need a modified `Sheet` component:

```bash
# 1. Copy the template component
cp src/client/components/ui/sheet.tsx src/client/components/project/sheet.tsx

# 2. Modify it as needed

# 3. Update your imports
# Before: import { Sheet } from '@/client/components/ui/sheet';
# After:  import { Sheet } from '@/client/components/project/sheet';
```

### Adding a New Component

```tsx
// src/client/components/project/custom-card.tsx
export function CustomCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      {children}
    </div>
  );
}
```

## Important Notes

- **This folder is NOT synced** from the template
- **Template `ui/` components ARE synced** - don't modify them directly
- When template updates a component you've customized, you'll need to manually merge changes
- Use semantic color tokens (`bg-background`, `text-foreground`) - never hardcode colors

## Folder Structure

```
src/client/components/
├── ui/                 # Template-owned (synced, don't modify)
│   ├── button.tsx
│   ├── card.tsx
│   └── ...
└── project/            # Project-specific (not synced)
    ├── README.md       # This file
    ├── sheet.tsx       # Your customized sheet
    └── ...
```
