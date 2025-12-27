# Training App - Development Guidelines

This document consolidates all development guidelines for the Training App project.

---

## Table of Contents

1. [Application Guidelines Checklist](#application-guidelines-checklist)
2. [Client-Server Communication](#client-server-communication)
3. [Feature-Based Structure](#feature-based-structure)
4. [State Management](#state-management)
5. [Pages and Routing](#pages-and-routing)
6. [React Components](#react-components)
7. [React Hooks](#react-hooks)
8. [shadcn/ui Components](#shadcnui-components)
9. [UI Design Guidelines](#ui-design-guidelines)
10. [Mobile-First UI](#mobile-first-ui)
11. [Training App Design System](#training-app-design-system)
12. [TypeScript Guidelines](#typescript-guidelines)
13. [MongoDB Usage](#mongodb-usage)
14. [AI Models API Usage](#ai-models-api-usage)
15. [Settings Usage](#settings-usage)
16. [User Access](#user-access)
17. [ESLint Guidelines](#eslint-guidelines)
18. [Template Sync](#template-sync)
19. [Feature Planning](#feature-planning)

---

## Application Guidelines Checklist

Use this checklist to verify compliance throughout the codebase.

### 1. API Guidelines Check

For each API module in `src/apis/apis.ts`:
- Check file structure: `index.ts`, `types.ts`, `server.ts`, and `client.ts` exist
- Verify API naming pattern:
  - API names defined ONLY in `index.ts`
  - Server re-exports API names from `index.ts`
  - Client imports API names from `index.ts` (NEVER from `server.ts`)
- Confirm types are defined in `types.ts` and never duplicated elsewhere
- Verify client functions return `CacheResult<ResponseType>`
- Check that business logic is implemented in `server.ts`

### 2. Feature-Based Structure Check

- Verify each feature has its own folder under `features/`
- Check that feature folders contain: `store.ts`, `hooks.ts`, `types.ts`, `index.ts`
- Ensure feature components live in the feature folder, not `components/`
- Verify features export via `index.ts` (public API)
- Check imports use feature path: `@/client/features/{name}`

### 3. Zustand Store Factory Check

- **ALL stores MUST use `createStore` from `@/client/stores`**
- No direct `import { create } from 'zustand'` (blocked by ESLint)
- Each store must have: `key`, `label`, `creator`, and either `persistOptions` OR `inMemoryOnly: true`

### 4. shadcn/ui Component Library Check

- **ALL UI components MUST use shadcn/ui** (no Material-UI, Ant Design, Chakra, etc.)
- Verify imports are from `@/client/components/ui/*`
- Check that semantic color tokens are used (never hardcoded colors)
- Confirm proper icon usage with `lucide-react`

### 5. Final Verification

```bash
yarn checks
```

The application is not compliant until `yarn checks` completes with 0 errors.

---

## Client-Server Communication

### API Architecture

```
/src
  /apis
    /apis.ts           - Registry of all API handlers
    /processApiCall.ts - Central processing logic with caching
    /types.ts          - Shared API types
    /<domain>
      /types.ts        - Shared request/response types
      /server.ts       - Server-side logic coordinator
      /client.ts       - Client-side function(s)
      /index.ts        - Exports API name constants
      /handlers/       - Individual API operation handlers
```

### Creating a New API Endpoint

1. **Define Types in `types.ts`**
   - Request/response interfaces
   - Client-facing DTOs
   - **ALL types MUST be defined here and imported from here**

2. **Define API Names in `index.ts`**
   ```typescript
   export const name = 'activity';
   export const API_CREATE_ACTIVITY_TYPE = 'activity/createActivityType';
   ```

3. **Implement Server Logic**
   - Create handlers in `handlers/` subdirectory
   - Each handler exports a `process` function
   - `server.ts` must `export * from './index';`

4. **Create Client Functions in `client.ts`**
   ```typescript
   import apiClient from '@/client/utils/apiClient';
   import { CacheResult } from '@/server/cache/types';
   import { API_CREATE_ACTIVITY_TYPE } from './index';

   export const createActivityType = (
     payload: CreateActivityPayload
   ): Promise<CacheResult<CreateActivityResponse>> => {
     return apiClient.call(API_CREATE_ACTIVITY_TYPE, payload);
   };
   ```

5. **Register in `apis.ts`**

### Data Fetching with React Query

Components should **NOT** call API client functions directly. Use React Query hooks:

```typescript
// hooks.ts
export function useTodos() {
    return useQuery({
        queryKey: ['todos'],
        queryFn: async () => {
            const response = await getTodos({});
            if (response.data?.error) throw new Error(response.data.error);
            return response.data;
        },
    });
}
```

### Offline Mode Behavior

When offline, `apiClient.post` returns `{ data: {}, isFromCache: false }`.
**All mutation `onSuccess` callbacks MUST guard against empty data:**

```typescript
// CORRECT
onSuccess: (data) => {
    if (data && data.todo) {
        queryClient.setQueryData(['todos', data.todo._id], { todo: data.todo });
    }
    queryClient.invalidateQueries({ queryKey: ['todos'] });
},
```

---

## Feature-Based Structure

### Directory Structure

```
src/client/
├── features/           # Feature modules
│   ├── auth/
│   │   ├── store.ts    # Zustand store (uses createStore)
│   │   ├── hooks.ts    # React Query hooks
│   │   ├── types.ts
│   │   └── index.ts    # Public API exports
│   └── settings/
├── stores/             # Store factory & registry
├── routes/             # Route/page components
├── components/         # Shared UI components ONLY
│   ├── ui/             # shadcn components
│   └── layout/         # Layout components
├── query/              # React Query infrastructure
└── utils/              # Shared utilities
```

### Rules

1. **Features contain ALL feature-related code**
2. **All stores MUST use createStore factory**
   ```typescript
   import { createStore } from '@/client/stores';

   export const useMyStore = createStore<MyState>({
       key: 'my-storage',
       label: 'My Store',
       creator: (set) => ({ ... }),
       persistOptions: { ... },  // OR inMemoryOnly: true
   });
   ```
3. **Routes folder is for route-specific code**
4. **Features export via index.ts**
5. **Import from feature index, not internal files**
6. **Shared components go in `components/`** (primitives only)

---

## State Management

### Quick Decision Table

| State Type | Solution |
|------------|----------|
| API data (todos, users, etc.) | **React Query** |
| User preferences (theme, offline) | **Zustand** (`features/settings`) |
| Auth hints | **Zustand** (`features/auth`) |
| Route persistence | **Zustand** (`features/router`) |
| Ephemeral UI (modal, form input) | **useState** |

### Zustand Store Factory (REQUIRED)

```typescript
import { createStore } from '@/client/stores';

// PERSISTED store
const useMyStore = createStore<MyState>({
    key: 'my-storage',
    label: 'My Store',
    creator: (set) => ({ ... }),
    persistOptions: { partialize: (state) => ({ ... }) },
});

// IN-MEMORY store
const useModalStore = createStore<ModalState>({
    key: 'modal',
    label: 'Modal',
    inMemoryOnly: true,
    creator: (set) => ({ ... }),
});
```

### Optimistic-Only Mutation Pattern

**NEVER update UI from server responses on SUCCESS. Only rollback on ERROR.**

```typescript
useMutation({
    mutationFn: async (data) => { ... },

    // UPDATE UI IMMEDIATELY
    onMutate: async (variables) => {
        await queryClient.cancelQueries({ queryKey: ['entity'] });
        const previous = queryClient.getQueryData(['entity']);
        queryClient.setQueryData(['entity'], (old) => ({ ...old, ...variables }));
        return { previous };
    },

    // ONLY on error: rollback
    onError: (_error, _variables, context) => {
        if (context?.previous) {
            queryClient.setQueryData(['entity'], context.previous);
        }
    },

    // onSuccess: EMPTY - never update from server response
    // onSettled: EMPTY - never invalidateQueries
});
```

---

## Pages and Routing

### Adding a New Route

1. **Create Route Component Folder**
   ```
   src/client/routes/NewRoute/
   ├── NewRoute.tsx
   ├── hooks.ts          # React Query hooks
   └── index.ts
   ```

2. **Register in Routes Configuration**
   ```typescript
   // src/client/routes/index.ts
   export const routes = createRoutes({
     '/new-route': NewRoute,
   });
   ```

3. **Add Navigation Item**
   ```typescript
   // src/client/components/NavLinks.tsx
   export const navItems: NavItem[] = [
     { path: '/new-route', label: 'New Route', icon: <Extension /> },
   ];
   ```

### Navigation Guidelines

- **Always use `useRouter`** - Never use `window.location.href`
- Route path naming: kebab-case (e.g., `/new-route`)
- Route parameters: `/items/:id`
- Query parameters: Access via `queryParams`

### Data Fetching Pattern

```tsx
// hooks.ts
export function useTodos() {
    return useQuery({
        queryKey: ['todos'],
        queryFn: async () => {
            const response = await getTodos({});
            if (response.data?.error) throw new Error(response.data.error);
            return response.data;
        },
    });
}

// Todos.tsx
export const Todos = () => {
    const { data, isLoading, error } = useTodos();

    if (isLoading && !data) return <LoadingSpinner />;
    if (error) return <ErrorDisplay error={error} />;

    return <TodoList todos={data?.todos || []} />;
};
```

---

## React Components

### Core Principles

1. **Single Responsibility**: Each component handles one concern
2. **Separation of Logic and UI**: Separate business logic from rendering
3. **Composition over Complexity**: Compose small components
4. **Consistent Folder Structure**

### File Organization

```
src/client/routes/[ROUTE_NAME]/
├── [ROUTE_NAME].tsx     # Main route component
├── index.ts
├── hooks.ts             # React Query hooks
├── components/          # Route-specific components
└── types.ts
```

### State Management Pattern

```typescript
// Server State: React Query
const { data, isLoading } = useTodos();

// Client State: Zustand
import { useUser, useAuthStore } from '@/client/features/auth';
const user = useUser();

// Local State: useState for ephemeral UI only
```

### File Size Guidelines

- Component files: under 150 lines
- `hooks.ts` files: up to 300 lines
- If exceeding limits, split by concern

---

## React Hooks

### Query Hooks (GET requests)

```typescript
export function useTodos(options?: { enabled?: boolean }) {
    const queryDefaults = useQueryDefaults();

    return useQuery({
        queryKey: ['todos'],
        queryFn: async () => {
            const response = await getTodos({});
            if (response.data?.error) throw new Error(response.data.error);
            return response.data;
        },
        enabled: options?.enabled ?? true,
        ...queryDefaults,
    });
}
```

### Mutation Hooks (POST requests)

```typescript
export function useUpdateTodo() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: UpdateTodoRequest) => {
            const response = await updateTodo(data);
            if (response.data?.error) throw new Error(response.data.error);
            return response.data?.todo;
        },
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: ['todos'] });
            const previousTodos = queryClient.getQueryData(['todos']);
            queryClient.setQueryData(['todos'], (old) => { /* optimistic update */ });
            return { previousTodos };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousTodos) {
                queryClient.setQueryData(['todos'], context.previousTodos);
            }
        },
        onSuccess: (data) => {
            if (data && data._id) {
                queryClient.setQueryData(['todos', data._id], { todo: data });
            }
            queryClient.invalidateQueries({ queryKey: ['todos'] });
        },
    });
}
```

### Query Key Conventions

```typescript
export const todosQueryKey = ['todos'] as const;
export const todoQueryKey = (id: string) => ['todos', id] as const;
```

---

## shadcn/ui Components

**CRITICAL**: This project uses shadcn/ui as its ONLY component library.

### Core Rules

1. **Use shadcn/ui Components Only**
   ```tsx
   // CORRECT
   import { Button } from '@/client/components/ui/button';

   // WRONG
   import { Button } from '@mui/material';
   ```

2. **Use Semantic Color Tokens**
   ```tsx
   // CORRECT
   <div className="bg-background text-foreground">

   // WRONG
   <div className="bg-white text-black">
   ```

3. **Available Semantic Tokens**
   - `bg-background` / `text-foreground` - Page background
   - `bg-card` / `text-card-foreground` - Cards
   - `bg-primary` / `text-primary-foreground` - Primary actions
   - `bg-muted` / `text-muted-foreground` - Muted states
   - `bg-destructive` / `text-destructive-foreground` - Errors

4. **Use Component Variants**
   ```tsx
   <Button variant="default">Primary</Button>
   <Button variant="secondary">Secondary</Button>
   <Button variant="outline">Outlined</Button>
   <Button variant="ghost">Ghost</Button>
   <Button variant="destructive">Delete</Button>
   ```

5. **Use `asChild` for Composition**
   ```tsx
   <DialogTrigger asChild>
     <Button variant="outline">Open</Button>
   </DialogTrigger>
   ```

6. **Accessibility**
   ```tsx
   <Label htmlFor="email">Email</Label>
   <Input id="email" type="email" />
   ```

7. **Icons with lucide-react**
   ```tsx
   import { Plus, Edit, Trash } from 'lucide-react';
   ```

8. **Controlled Components**
   ```tsx
   <Dialog open={isOpen} onOpenChange={setIsOpen}>
   <Select value={value} onValueChange={setValue}>
   ```

### Adding New Components

```bash
npx shadcn@latest add button
npx shadcn@latest add card
```

---

## UI Design Guidelines

### Design Tokens

```css
:root {
  --color-primary: #007AFF;
  --color-success: #34C759;
  --color-warning: #FF9500;
  --color-error: #FF3B30;

  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;

  --border-radius-sm: 8px;
  --border-radius-md: 12px;
  --border-radius-lg: 16px;
}
```

### Typography Scale

| Usage | Classes |
|-------|---------|
| Page titles | `text-2xl font-semibold` |
| Section titles | `text-lg font-medium` |
| Body | default text |
| Secondary | `text-muted-foreground` |

### Touch Targets

- Minimum: `44px x 44px` (iOS HIG requirement)

### Dark/Light Mode

- Use `next-themes` with `attribute="class"`
- Rely on semantic tokens for automatic adaptation
- Never conditionalize classes on theme

### Animations

- Micro (button press): 100-150ms
- Short (card hover): 150-200ms
- Medium (modal open): 200-300ms
- Long (page transition): 300-400ms

---

## Mobile-First UI

### Default Page Scaffold

```tsx
<div className="flex min-h-screen flex-col">
  <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
    <div className="mx-auto flex h-14 w-full max-w-screen-lg items-center px-3 sm:px-4" />
  </header>
  <main className="mx-auto w-full max-w-screen-lg flex-1 px-2 py-3 pb-20 sm:px-4 sm:pb-4">
    {/* content */}
  </main>
</div>
```

### Key Rules

- Build for mobile first, enhance with `sm:`/`md:` modifiers
- Use `pb-20` on mobile main for bottom navigation clearance
- Use semantic tokens, not hex values
- Loading states: Use linear progress bar (no spinners)
- Touch targets: minimum `h-9` with `px-3` padding

### Navigation

- Top bar: `h-14`, `backdrop-blur`, `bg-background/80`
- Bottom nav: `fixed inset-x-0 bottom-0 z-40 sm:hidden`
- Action buttons: `variant="ghost" size="icon"`

---

## Training App Design System

### Design Philosophy

- **Gym-Ready**: Large touch targets, high contrast
- **Native Feel**: iOS/Android patterns, smooth animations
- **Energizing**: Vibrant progress indicators
- **Premium**: Subtle shadows, smooth transitions
- **Focused**: Clear hierarchy, no clutter

### Page Structure

```
┌─────────────────────────────────────┐
│  PageHeader (optional back button)  │
├─────────────────────────────────────┤
│  Content (scrollable)               │
│  - padding: px-4                    │
│  - bottom padding: pb-20            │
├─────────────────────────────────────┤
│  ActionBar (if needed)              │
└─────────────────────────────────────┘
│  BottomNavBar (fixed)               │
└─────────────────────────────────────┘
```

### Button Press Effect

```tsx
<Button className="active:scale-[0.97] transition-transform duration-100">
```

### Card Styling

```tsx
// Standard card
<Card className="rounded-2xl border-0 bg-card shadow-sm">

// Interactive card
<Card className="rounded-2xl border-0 bg-card shadow-sm active:scale-[0.98] transition-all duration-100">

// Completed card
<Card className="rounded-2xl border-2 border-green-500/50 bg-green-500/5">
```

### Action Buttons (Set Controls)

```tsx
// Plus button - primary
<Button className="h-12 w-12 rounded-full p-0 bg-gradient-to-br from-primary to-primary/80 shadow-lg">
  <Plus className="h-6 w-6" />
</Button>

// Done button - success
<Button className="h-12 w-12 rounded-full p-0 bg-gradient-to-br from-green-500 to-emerald-600">
  <CheckCheck className="h-6 w-6" />
</Button>
```

### Progress Bars

```tsx
<div className="h-2 bg-muted rounded-full overflow-hidden">
  <div
    className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500"
    style={{ width: `${percentage}%` }}
  />
</div>
```

### Loading States (Use Skeleton)

```tsx
<div className="grid gap-4">
  {[1, 2, 3].map((i) => (
    <Card key={i} className="p-4">
      <div className="flex gap-4">
        <Skeleton className="h-20 w-20 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    </Card>
  ))}
</div>
```

---

## TypeScript Guidelines

### Core Principles

- **Type Safety First**: Catch errors at compile time
- **Explicit over Implicit**: Prefer explicit type annotations
- **Simplicity over Complexity**: Avoid complex type structures
- **Consistency**: Maintain consistent patterns

### Best Practices

1. **Enable `strict` Mode** in `tsconfig.json`
2. **Avoid Using `any`** - Use `unknown` and narrow down
3. **Never cast to `any`** (`as any`)
4. **Always Type Function Parameters and Return Values**
5. **Use `interface` for extensible objects, `type` for unions**
6. **Prefer Union Types Over Enums**
7. **Use `readonly` for Immutable Data**
8. **Narrow Types Before Using Them**
9. **Keep Types Close to Data They Describe**
10. **DO NOT Create Complex Types**

---

## MongoDB Usage

### Core Principles

1. **Encapsulation**: All operations in `src/server/database`
2. **No Direct MongoDB Imports** outside database layer
3. **Clean API Layer**: Interact through exported functions
4. **Type Safety**: Use TypeScript interfaces

### Structure

```
/src/server/database
  /index.ts
  /collections
    /<collection-name>
      /types.ts
      /<collection-name>.ts
```

### Correct Usage

```typescript
// src/server/database/collections/exercises/exercises.ts
import { getDb } from '@/server/database';

const getExercisesCollection = async () => {
  const db = await getDb();
  return db.collection<Exercise>('exercises');
};

export const findExercisesForPlan = async (planId: ObjectId) => {
  const collection = await getExercisesCollection();
  // Implementation...
};
```

### In API Layer

```typescript
// src/apis/exercises/server.ts
import { exercises } from '@/server/database';

const exercisesList = await exercises.findExercisesForPlan(params.planId);
```

### What NOT To Do

- Never import MongoDB directly in API layer
- Never access collections directly from API layer

---

## AI Models API Usage

### Core Principles

- **NEVER use AI models directly** - Use adapter pattern
- **Server-Side Only**: All AI calls server-side
- **Use Adapter Pattern**: `AIModelAdapter` from `src/server/ai/baseModelAdapter.ts`
- **Include Caching**: All AI calls must cache
- **Cost Tracking**: Always track costs

### Correct Usage

```typescript
import { AIModelAdapter } from "../ai/baseModelAdapter";
import { isModelExists } from "../ai/models";

async function handleChatRequest(request: ChatRequest) {
  if (!isModelExists(request.modelId)) {
    return { error: `Invalid model ID: ${request.modelId}` };
  }

  const adapter = new AIModelAdapter(request.modelId);
  const response = await adapter.processPromptToText(request.message);

  return {
    result: response.result,
    cost: response.cost,
  };
}
```

### What NOT To Do

- Never call AI APIs directly
- Never call AI APIs from client-side
- Never hardcode model IDs
- Never ignore costs
- Never skip model ID validation

---

## Settings Usage

### Accessing Settings

```typescript
import { useSettingsStore } from '@/client/features/settings';

const MyComponent = () => {
    const aiModel = useSettingsStore((state) => state.settings.aiModel);
    const updateSettings = useSettingsStore((state) => state.updateSettings);

    const handleUpdateModel = (newModelId: string) => {
        updateSettings({ aiModel: newModelId });
    };
};
```

### Offline Mode Detection

```typescript
import { useSettingsStore, useEffectiveOffline } from '@/client/features/settings';

const effectiveOffline = useEffectiveOffline(); // true if offline OR user enabled offline mode
```

### Adding a New Settings Field

1. Update `Settings` interface in `types.ts`
2. Update `defaultSettings` in `types.ts`
3. Settings automatically persist via Zustand

---

## User Access

### Client-Side

```tsx
import { useAuth } from '../context/AuthContext';

const { user } = useAuth();
const userId = user?.id;
```

### Server-Side (API Handlers)

```typescript
export const handleMyApiRequest = async (
    request: MyApiRequest,
    context: ApiHandlerContext
): Promise<MyApiResponse> => {
    const userId = context.userId;

    if (!userId) {
        return { error: "User not authenticated." };
    }

    // Use userId...
};
```

---

## ESLint Guidelines

### ESLint Disable Comments

- Do not use `// eslint-disable-next-line` unless specifically instructed
- **Exception**: `state-management/prefer-state-architecture`

### State Management Rule

When `useState` is appropriate, add disable comment WITH explanation:

```typescript
// eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral modal state
const [isOpen, setIsOpen] = useState(false);
```

### Valid Justifications

- `ephemeral modal/dialog state`
- `form input before submission`
- `local loading indicator`
- `accordion/expand state`
- `hover/focus state`

### Post-Linting

Always run `yarn checks` after fixing lint issues.

---

## Template Sync

This project uses a template sync system to receive updates from the base template repository.

### Key Commands

```bash
# Preview what would change (always do this first)
yarn sync-template --dry-run

# Apply template updates
yarn sync-template

# Merge specific files from template
yarn merge-template src/pages/_document.tsx scripts/generate-icons.ts
```

### Configuration File

Edit `.template-sync.json` to customize sync behavior:

```json
{
  "ignoredFiles": [
    "package.json",
    "src/client/routes/index.ts",
    "src/apis/apis.ts"
  ],
  "projectSpecificFiles": [
    "public/icons/*",
    "public/manifest.json",
    "src/config/pwa.config.ts"
  ]
}
```

### Key Fields

- **ignoredFiles**: Files never touched during sync (system files, registry files, example features)
- **projectSpecificFiles**: Your custom code that shouldn't be overwritten by template updates

### Glob Pattern Support

Both arrays support glob patterns:
- `*` - Matches any characters except `/`
- `**` - Matches any characters including `/`

### Workflow

1. Run `yarn sync-template --dry-run` to preview changes
2. Choose `[1] Safe only` for non-conflicting updates
3. Test with `yarn checks && yarn dev`
4. Run again with `[2] All changes` for conflicts
5. Manually merge any `.template` files
6. Commit changes

### Full Documentation

See `.cursor/commands/sync-template.md` for complete documentation.

---

## Feature Planning

### Plan Structure

1. **High-Level Solution** (2-4 sentences)
2. **Implementation Details** (files, changes, code snippets)
3. **Implementation Phases** (logical phases with objectives)
4. **Potential Issues & Open Questions**
5. **Task List** (checkbox format)

### Task List Format

```
- [ ] Task 1: Set up API structure
- [ ] Task 2: Implement database collections
- [ ] Task 3: Create React components
```

Mark tasks as `[x]` when completed during implementation.

### Additional Considerations

- Follow all application guidelines
- Consider impact on existing features
- Plan for error handling and edge cases
- Consider performance implications
- Always prefer simplicity over complexity
- Production ready

Write plans to `feature-plans/` folder in project root.
