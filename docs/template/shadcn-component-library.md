---
title: UI & Styling
description: shadcn/ui components with semantic theming. Use this when adding/editing UI components.
summary: Use shadcn/ui as the ONLY component library. All colors must use semantic tokens (`bg-background`, `text-foreground`), never hardcode colors (`bg-white`, `text-black`).
priority: 3
related_docs:
  - theming.md
related_rules:
  - shadcn-usage
  - theming-guidelines
---

# shadcn/ui Component Library Guide

This document provides a comprehensive guide to using shadcn/ui components in this application. shadcn/ui is a collection of re-usable components built using Radix UI and Tailwind CSS.

## Table of Contents

1. [Overview](#overview)
2. [Installation & Setup](#installation--setup)
3. [Core Components](#core-components)
4. [Theme System](#theme-system)
5. [Component Patterns](#component-patterns)
6. [Best Practices](#best-practices)
7. [Common Recipes](#common-recipes)

---

## Overview

### What is shadcn/ui?

shadcn/ui is NOT a traditional component library. Instead, it provides:

- **Copy-paste components**: Components are added to your project, not installed as a dependency
- **Full ownership**: You own the code and can customize it freely
- **Built on Radix UI**: Accessible primitives with unstyled components
- **Styled with Tailwind**: Utility-first CSS with semantic color tokens
- **TypeScript first**: Full type safety out of the box

### Why shadcn/ui?

✅ **Customizable**: You own the code, modify as needed  
✅ **Accessible**: Built on Radix UI (ARIA compliant)  
✅ **No runtime**: Just React + Tailwind (no extra dependencies)  
✅ **Type-safe**: Full TypeScript support  
✅ **Tree-shakeable**: Only bundle what you use  
✅ **Mobile-first**: Responsive by default

---

## Installation & Setup

### Component Location

All shadcn components are located in:

```
src/client/components/ui/
├── button.tsx
├── card.tsx
├── input.tsx
├── label.tsx
├── dialog.tsx
├── sheet.tsx
├── dropdown-menu.tsx
└── ... (other components)
```

### Template vs Project Components

**IMPORTANT:** The `ui/` folder is **template-owned** and synced automatically. Never modify files directly in `ui/`.

For project-specific components or customizations, use the `project/` folder:

```
src/client/components/
├── ui/              # Template-owned (synced, DON'T modify)
│   ├── button.tsx
│   ├── card.tsx
│   └── ...
└── project/         # Project-specific (NOT synced)
    ├── sheet.tsx    # Your customized sheet
    └── ...
```

**When to use `project/`:**
- Customizing a shadcn component (copy from `ui/`, modify in `project/`)
- Adding components unique to your project
- Adding shadcn components not included in the template

**Example - Customizing Sheet:**
```bash
# 1. Copy the component
cp src/client/components/ui/sheet.tsx src/client/components/project/sheet.tsx

# 2. Modify as needed

# 3. Update imports in your code
# Before: import { Sheet } from '@/client/components/ui/sheet';
# After:  import { Sheet } from '@/client/components/project/sheet';
```

### Adding New Components

Use the shadcn CLI to add components:

```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
```

Components are automatically added to `src/client/components/ui/` with proper TypeScript types.

### Theme Configuration

Theme colors are defined in `src/client/styles/globals.css`:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 0 0% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 3.9%;
    --primary: 0 0% 9%;
    --primary-foreground: 0 0% 98%;
    --secondary: 0 0% 96.1%;
    --secondary-foreground: 0 0% 9%;
    --muted: 0 0% 96.1%;
    --muted-foreground: 0 0% 45.1%;
    --accent: 0 0% 96.1%;
    --accent-foreground: 0 0% 9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 89.8%;
    --input: 0 0% 89.8%;
    --ring: 0 0% 3.9%;
    --radius: 0.5rem;
  }
 
  .dark {
    --background: 0 0% 3.9%;
    --foreground: 0 0% 98%;
    /* ... dark mode colors */
  }
}
```

---

## Core Components

### Button

The most versatile component with multiple variants and sizes.

```tsx
import { Button } from '@/client/components/ui/button';

// Variants
<Button variant="default">Primary Action</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outlined</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>
<Button variant="destructive">Delete</Button>

// Sizes
<Button size="default">Default</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon className="h-4 w-4" /></Button>

// States
<Button disabled>Disabled</Button>
<Button loading>Loading...</Button>

// With icons
<Button>
  <Plus className="mr-2 h-4 w-4" />
  Add Item
</Button>
```

**Variants:**
- `default` - Primary action (solid background)
- `secondary` - Secondary action (subtle background)
- `outline` - Outlined button
- `ghost` - Transparent background, hover effect
- `link` - Text link styling
- `destructive` - Dangerous actions (delete, etc.)

**Sizes:**
- `default` - Standard size (h-10 px-4)
- `sm` - Small (h-9 px-3)
- `lg` - Large (h-11 px-8)
- `icon` - Square icon button (h-10 w-10)

### Card

Container component for grouping content.

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/client/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description goes here</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Main content of the card</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

**Best practices:**
- Use for grouping related information
- Include CardHeader for titles
- Use CardFooter for actions
- Combine with other components (forms, lists)

### Input

Text input with label integration.

```tsx
import { Input } from '@/client/components/ui/input';
import { Label } from '@/client/components/ui/label';

<div className="grid gap-2">
  <Label htmlFor="email">Email</Label>
  <Input 
    id="email" 
    type="email" 
    placeholder="Enter your email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
  />
</div>

// With error state
<div className="grid gap-2">
  <Label htmlFor="password">Password</Label>
  <Input 
    id="password" 
    type="password"
    className={error ? "border-destructive" : ""}
  />
  {error && <p className="text-sm text-destructive">{error}</p>}
</div>
```

### Dialog

Modal dialog for focused interactions.

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/client/components/ui/dialog';

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>
        Dialog description or instructions
      </DialogDescription>
    </DialogHeader>
    
    {/* Dialog content */}
    <div className="grid gap-4 py-4">
      {/* Your form or content here */}
    </div>
    
    <DialogFooter>
      <Button variant="outline" onClick={() => setIsOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleSubmit}>
        Save
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Features:**
- Overlay with backdrop
- Focus trap (keyboard navigation)
- ESC to close
- Click outside to close
- Accessible (ARIA attributes)

### Sheet

Slide-out panel (drawer) for mobile navigation or side panels.

```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/client/components/ui/sheet';

<Sheet open={isOpen} onOpenChange={setIsOpen}>
  <SheetContent side="left"> {/* or "right", "top", "bottom" */}
    <SheetHeader>
      <SheetTitle>Navigation</SheetTitle>
      <SheetDescription>
        App navigation menu
      </SheetDescription>
    </SheetHeader>
    
    <nav className="grid gap-2 py-4">
      {/* Navigation items */}
    </nav>
  </SheetContent>
</Sheet>
```

**Sides:**
- `left` - Slide from left (default for mobile nav)
- `right` - Slide from right
- `top` - Slide from top
- `bottom` - Slide from bottom

### Select

Dropdown select component.

```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/client/components/ui/select';

<Select value={value} onValueChange={setValue}>
  <SelectTrigger className="w-[180px]">
    <SelectValue placeholder="Select option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
    <SelectItem value="option3">Option 3</SelectItem>
  </SelectContent>
</Select>
```

### Switch

Toggle switch for boolean values.

```tsx
import { Switch } from '@/client/components/ui/switch';
import { Label } from '@/client/components/ui/label';

<div className="flex items-center space-x-2">
  <Switch 
    id="offline-mode" 
    checked={isOffline}
    onCheckedChange={setIsOffline}
  />
  <Label htmlFor="offline-mode">Offline Mode</Label>
</div>
```

### Badge

Small status or label indicator.

```tsx
import { Badge } from '@/client/components/ui/badge';

<Badge>Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="outline">Outline</Badge>
<Badge variant="destructive">Error</Badge>
```

### Alert

Attention-grabbing message component.

```tsx
import { Alert, AlertTitle, AlertDescription } from '@/client/components/ui/alert';
import { AlertCircle } from 'lucide-react';

<Alert>
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Heads up!</AlertTitle>
  <AlertDescription>
    Important information goes here
  </AlertDescription>
</Alert>

<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>
    Something went wrong
  </AlertDescription>
</Alert>
```

### Dropdown Menu

Context menu for actions.

```tsx
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/client/components/ui/dropdown-menu';

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon">
      <MoreVertical className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuLabel>Actions</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={handleEdit}>
      <Edit className="mr-2 h-4 w-4" />
      Edit
    </DropdownMenuItem>
    <DropdownMenuItem onClick={handleDelete}>
      <Trash className="mr-2 h-4 w-4" />
      Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Separator

Visual divider between content sections.

```tsx
import { Separator } from '@/client/components/ui/separator';

<div>
  <h2>Section 1</h2>
  <Separator className="my-4" />
  <h2>Section 2</h2>
</div>
```

### Avatar

User profile picture or initials.

```tsx
import { Avatar, AvatarImage, AvatarFallback } from '@/client/components/ui/avatar';

<Avatar>
  <AvatarImage src={user.avatarUrl} alt={user.name} />
  <AvatarFallback>{user.initials}</AvatarFallback>
</Avatar>
```

---

## Theme System

### Semantic Color Tokens

Always use semantic tokens instead of hardcoded colors:

```tsx
// ✅ Good - Uses semantic tokens
<div className="bg-background text-foreground">
  <Card className="bg-card text-card-foreground">
    <Button className="bg-primary text-primary-foreground">
      Action
    </Button>
  </Card>
</div>

// ❌ Bad - Hardcoded colors
<div className="bg-white text-black dark:bg-gray-900 dark:text-white">
  <div className="bg-blue-500 text-white">
    <button>Action</button>
  </div>
</div>
```

### Available Tokens

| Token | Usage |
|-------|-------|
| `bg-background` / `text-foreground` | Page background and text |
| `bg-card` / `text-card-foreground` | Card backgrounds |
| `bg-popover` / `text-popover-foreground` | Popover, dropdown backgrounds |
| `bg-primary` / `text-primary-foreground` | Primary actions |
| `bg-secondary` / `text-secondary-foreground` | Secondary actions |
| `bg-muted` / `text-muted-foreground` | Muted/disabled states |
| `bg-accent` / `text-accent-foreground` | Accent/hover states |
| `bg-destructive` / `text-destructive-foreground` | Errors, delete actions |
| `border-border` | Borders |
| `ring-ring` | Focus rings |

### Dark Mode

Dark mode is automatically handled via the `.dark` class on the HTML element:

```tsx
import { useTheme } from 'next-themes';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
    >
      {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  );
}
```

---

## Component Patterns

### Form Pattern

```tsx
import { Button } from '@/client/components/ui/button';
import { Input } from '@/client/components/ui/input';
import { Label } from '@/client/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/client/components/ui/card';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Login</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </form>
      </CardContent>
      <CardFooter>
        <Button className="w-full">Sign In</Button>
      </CardFooter>
    </Card>
  );
}
```

### List with Actions Pattern

```tsx
import { Card } from '@/client/components/ui/card';
import { Button } from '@/client/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/client/components/ui/dropdown-menu';
import { MoreVertical, Edit, Trash } from 'lucide-react';

function ItemList({ items }: { items: Item[] }) {
  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <Card key={item.id} className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-medium">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleEdit(item.id)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDelete(item.id)}>
                  <Trash className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Card>
      ))}
    </div>
  );
}
```

### Loading State Pattern

```tsx
import { Button } from '@/client/components/ui/button';
import { Card, CardContent } from '@/client/components/ui/card';
import { Skeleton } from '@/client/components/ui/skeleton';

function DataView() {
  const { data, isLoading } = useQuery(...);
  
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardContent className="p-4">
        {/* Actual content */}
      </CardContent>
    </Card>
  );
}
```

### Responsive Navigation Pattern

```tsx
import { Sheet, SheetContent, SheetTrigger } from '@/client/components/ui/sheet';
import { Button } from '@/client/components/ui/button';
import { Menu } from 'lucide-react';

function ResponsiveNav() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="flex h-14 items-center px-4">
        {/* Mobile menu */}
        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <nav className="grid gap-2">
              {/* Mobile nav items */}
            </nav>
          </SheetContent>
        </Sheet>
        
        {/* Desktop nav */}
        <nav className="hidden md:flex md:gap-2">
          {/* Desktop nav items */}
        </nav>
      </div>
    </header>
  );
}
```

---

## Best Practices

### 1. Always Use Semantic Tokens

```tsx
// ✅ Good
<div className="bg-background text-foreground border-border">

// ❌ Bad
<div className="bg-white text-black border-gray-200 dark:bg-gray-900">
```

### 2. Use asChild for Custom Triggers

```tsx
// ✅ Good - Proper composition
<Dialog>
  <DialogTrigger asChild>
    <Button variant="outline">Open</Button>
  </DialogTrigger>
</Dialog>

// ❌ Bad - Creates nested buttons
<Dialog>
  <DialogTrigger>
    <Button>Open</Button>
  </DialogTrigger>
</Dialog>
```

### 3. Provide Proper Labels

```tsx
// ✅ Good - Accessible
<div className="grid gap-2">
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" />
</div>

// ❌ Bad - No label association
<div>
  <p>Email</p>
  <Input type="email" />
</div>
```

### 4. Handle Loading States

```tsx
// ✅ Good
<Button disabled={isLoading}>
  {isLoading ? 'Saving...' : 'Save'}
</Button>

// ❌ Bad - No loading feedback
<Button onClick={handleSave}>Save</Button>
```

### 5. Use Controlled Components

```tsx
// ✅ Good - Controlled
<Dialog open={isOpen} onOpenChange={setIsOpen}>

// ❌ Bad - Uncontrolled (harder to manage)
<Dialog>
```

### 6. Combine with Icons from lucide-react

```tsx
import { Plus, Edit, Trash, Menu } from 'lucide-react';

<Button>
  <Plus className="mr-2 h-4 w-4" />
  Add Item
</Button>
```

### 7. Respect Touch Targets (Mobile)

```tsx
// ✅ Good - 44px minimum
<Button size="default">Click Me</Button>

// ❌ Bad - Too small for touch
<button className="p-1">Click</button>
```

---

## Common Recipes

### Confirm Delete Dialog

```tsx
function DeleteConfirmDialog({ isOpen, onOpenChange, onConfirm, itemName }) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>
            This will permanently delete "{itemName}". This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Search Input with Clear

```tsx
function SearchInput({ value, onChange }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 pr-9"
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
          onClick={() => onChange('')}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
```

### Empty State

```tsx
function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        {Icon && <Icon className="h-12 w-12 text-muted-foreground mb-4" />}
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4 text-center">
          {description}
        </p>
        {action && action}
      </CardContent>
    </Card>
  );
}

// Usage
<EmptyState
  icon={Inbox}
  title="No items yet"
  description="Get started by creating your first item"
  action={<Button><Plus className="mr-2 h-4 w-4" />Add Item</Button>}
/>
```

### Settings Toggle List

```tsx
function SettingsList() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex items-center justify-between">
          <div className="grid gap-1">
            <Label htmlFor="offline">Offline Mode</Label>
            <p className="text-sm text-muted-foreground">
              Use app without internet connection
            </p>
          </div>
          <Switch id="offline" checked={offline} onCheckedChange={setOffline} />
        </div>
        
        <Separator />
        
        <div className="flex items-center justify-between">
          <div className="grid gap-1">
            <Label htmlFor="notifications">Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Receive push notifications
            </p>
          </div>
          <Switch id="notifications" checked={notifications} onCheckedChange={setNotifications} />
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Reference

### Official Resources

- **shadcn/ui Docs**: https://ui.shadcn.com
- **Radix UI Primitives**: https://www.radix-ui.com/primitives
- **Tailwind CSS**: https://tailwindcss.com
- **lucide-react Icons**: https://lucide.dev

### Key Files

- Template Components: `src/client/components/ui/*` (synced, don't modify)
- Project Components: `src/client/components/project/*` (not synced, your customizations)
- Theme: `src/client/styles/globals.css`
- Theme Provider: `src/pages/_app.tsx` (next-themes)

### Related Guidelines

- Mobile-first UI: `docs/template/project-guidelines/ui-mobile-first-shadcn.md`
- UI Design: `docs/template/project-guidelines/ui-design-guidelines.md`
- Component Organization: `docs/template/project-guidelines/react-component-organization.md`

