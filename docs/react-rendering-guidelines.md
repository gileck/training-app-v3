# React Rendering Guidelines

This document covers common React rendering pitfalls that cause infinite loops, performance issues, and hard-to-debug bugs. These issues often pass TypeScript and ESLint checks but fail at runtime.

---

> **⚠️ IMPORTANT FOR PR REVIEWERS**
>
> This project has specific Zustand selector patterns that **differ from common conventions**.
> These patterns exist to prevent infinite re-render loops (React error #185).
>
> **DO NOT request changes to:**
> - Split individual selectors into combined object selectors
> - Return object literals `({...})` from selectors
>
> These patterns cause infinite loops in Zustand. If you see code using individual selectors,
> it is correct for this project. See "Anti-Pattern 2" below for full explanation.

---

## Zustand Selector Stability

### The Problem

Zustand selectors that return new object/array references on every render cause infinite re-render loops. This happens because React's `useSyncExternalStore` detects a "change" when the reference changes, even if the content is identical.

**Symptoms:**
- `Maximum update depth exceeded` error (React error #185)
- `The result of getSnapshot should be cached to avoid an infinite loop` warning
- App freezes or crashes on component mount

---

### Anti-Pattern 1: Object Literal Fallbacks

```typescript
// ❌ BAD: Returns new {} on every render when planId is null or data is missing
export function useWeekWorkoutSets(planId: string | null, weekNumber: number) {
    return usePlanDataStore((state) => {
        if (!planId) return {};  // New object every time!
        return state.plans[planId]?.workoutSets?.[weekNumber] ?? {};  // New object every time!
    });
}
```

**Fix:** Use stable fallback references

```typescript
// ✅ GOOD: Use stable fallback references
const EMPTY_WORKOUT_SETS: Record<string, Record<string, number>> = {};

export function useWeekWorkoutSets(planId: string | null, weekNumber: number) {
    return usePlanDataStore((state) => {
        if (!planId) return EMPTY_WORKOUT_SETS;  // Same reference every time
        return state.plans[planId]?.workoutSets?.[weekNumber] ?? EMPTY_WORKOUT_SETS;
    });
}
```

---

### Anti-Pattern 2: Combined Object Selectors (Destructuring Multiple Values)

> **🚨 THIS PROJECT FORBIDS COMBINED SELECTORS**
>
> This is a project-specific rule. Even though combined selectors are common in tutorials and
> other codebases, they cause **infinite re-render loops** in Zustand due to reference instability.
> Individual selectors are **required** in this codebase.

**CRITICAL:** Never use a selector that returns an object literal to extract multiple values at once. This is a common pattern in Redux that does NOT work safely in Zustand.

```typescript
// ❌ BAD: Combined selector returns new object every render → INFINITE LOOP
const {
    sortBy,
    hideCompleted,
    setSortBy,
    setHideCompleted,
} = useMyStore((state) => ({
    sortBy: state.sortBy,
    hideCompleted: state.hideCompleted,
    setSortBy: state.setSortBy,
    setHideCompleted: state.setHideCompleted,
}));
```

**Why this fails:** The selector `(state) => ({ ... })` creates a **new object on every render**. Zustand compares the new result to the previous result using shallow equality. Since `{} !== {}` (different references), Zustand thinks the state changed and triggers a re-render. This creates another new object, triggering another re-render, ad infinitum.

**Fix:** Use individual selectors for each value

```typescript
// ✅ GOOD: Individual selectors return stable references (primitives or functions)
const sortBy = useMyStore((state) => state.sortBy);
const hideCompleted = useMyStore((state) => state.hideCompleted);
const setSortBy = useMyStore((state) => state.setSortBy);
const setHideCompleted = useMyStore((state) => state.setHideCompleted);
```

**Why this works:** Each selector returns either:
- A **primitive value** (`string`, `number`, `boolean`) - always stable
- A **function reference** from the store - same reference unless store is recreated
- An **object/array from state** - same reference unless that specific state changes

**Alternative with `useShallow`:** If you must select multiple values, use Zustand's `useShallow` hook:

```typescript
import { useShallow } from 'zustand/react/shallow';

// ✅ GOOD: useShallow performs shallow comparison of object properties
const { sortBy, hideCompleted } = useMyStore(
    useShallow((state) => ({
        sortBy: state.sortBy,
        hideCompleted: state.hideCompleted,
    }))
);
```

**Note:** `useShallow` adds overhead and is generally not needed. Individual selectors are clearer and more performant.

---

### Rules Summary

1. **Never return `{}` or `[]` literals** in selector fallback paths
2. **Never use combined object selectors** `(state) => ({ a: state.a, b: state.b })`
3. **Use individual selectors** for each value you need
4. **Create module-level constants** for empty fallback values
5. **Name constants clearly**: `EMPTY_ITEMS`, `EMPTY_MAP`, `EMPTY_LIST`

### Example Stable Fallbacks

```typescript
// At the top of your store file
// Stable fallback references (prevent infinite loops)
const EMPTY_ITEMS: Item[] = [];
const EMPTY_MAP: Record<string, unknown> = {};
const EMPTY_LIST: string[] = [];
```

---

## useMemo/useCallback Dependencies

### The Problem

Missing or incorrect dependencies in `useMemo` and `useCallback` can cause stale closures or unnecessary recalculations.

### Rules

1. **Include all referenced values** in the dependency array
2. **Use ESLint exhaustive-deps rule** - don't disable it without good reason
3. **For objects/arrays from props**, consider if parent should memoize them

---

## Object Identity in Props

### The Problem

Passing inline objects or arrays as props causes child components to re-render on every parent render.

### Bad Pattern

```typescript
// BAD: New object created every render
<ChildComponent style={{ marginTop: 10 }} />
<ChildComponent items={[1, 2, 3]} />
<ChildComponent config={{ enabled: true }} />
```

### Good Pattern

```typescript
// GOOD: Stable references
const style = useMemo(() => ({ marginTop: 10 }), []);
const items = useMemo(() => [1, 2, 3], []);
const config = useMemo(() => ({ enabled: true }), []);

<ChildComponent style={style} />
<ChildComponent items={items} />
<ChildComponent config={config} />
```

---

## Conditional Hook Calls

### The Problem

Hooks must be called in the same order on every render. Conditional hook calls cause React to lose track of state.

### Bad Pattern

```typescript
// BAD: Hook called conditionally
function MyComponent({ showDetails }) {
    if (showDetails) {
        const data = useData();  // Conditional hook call!
    }
}
```

### Good Pattern

```typescript
// GOOD: Always call hook, conditionally use result
function MyComponent({ showDetails }) {
    const data = useData();  // Always called

    if (!showDetails) return null;
    return <Details data={data} />;
}
```

---

## State Updates in Render

### The Problem

Calling `setState` during render causes infinite loops.

### Bad Pattern

```typescript
// BAD: setState during render
function MyComponent({ value }) {
    const [processed, setProcessed] = useState(null);

    if (value !== processed) {
        setProcessed(value);  // Triggers re-render during render!
    }
}
```

### Good Pattern

```typescript
// GOOD: Use useEffect for derived state
function MyComponent({ value }) {
    const [processed, setProcessed] = useState(null);

    useEffect(() => {
        setProcessed(value);
    }, [value]);
}

// BETTER: Compute derived values without state
function MyComponent({ value }) {
    const processed = useMemo(() => transform(value), [value]);
}
```

---

## Debugging Tips

### Identifying Infinite Loops

1. Check browser console for `Maximum update depth exceeded`
2. Look for `The result of getSnapshot should be cached` warnings
3. Add `console.log` to suspected selectors to see if they're called repeatedly
4. Use React DevTools Profiler to see which components re-render

### Common Culprits

| Symptom | Likely Cause |
|---------|--------------|
| Loop on component mount | Unstable selector fallback |
| Loop on specific action | State update triggers selector change |
| Loop with specific data | Conditional selector returning new reference |

---

## Common Scenarios

### Arrays

```typescript
// ❌ BAD
export function useTodos() {
    return useStore((state) => state.todos || []);  // New array each time!
}

// ✅ GOOD
const EMPTY_TODOS: Todo[] = [];
export function useTodos() {
    return useStore((state) => state.todos || EMPTY_TODOS);
}
```

### Objects

```typescript
// ❌ BAD
export function useSettings() {
    return useStore((state) => state.settings ?? {});  // New object each time!
}

// ✅ GOOD
const DEFAULT_SETTINGS: Settings = {};
export function useSettings() {
    return useStore((state) => state.settings ?? DEFAULT_SETTINGS);
}
```

### Conditional Returns

```typescript
// ❌ BAD
export function useFilteredData(filter: string | null) {
    return useStore((state) => {
        if (!filter) return [];  // New array!
        return state.items.filter(item => item.category === filter);
    });
}

// ✅ GOOD
const EMPTY_DATA: Item[] = [];
export function useFilteredData(filter: string | null) {
    return useStore((state) => {
        if (!filter) return EMPTY_DATA;
        return state.items.filter(item => item.category === filter);
    });
}
```

### Nested Fallbacks

```typescript
// ❌ BAD
export function useUserData(userId: string | null) {
    return useStore((state) => {
        const user = state.users[userId];
        return user?.data ?? {};  // New object if no data!
    });
}

// ✅ GOOD
const EMPTY_USER_DATA: UserData = {};
export function useUserData(userId: string | null) {
    return useStore((state) => {
        const user = state.users[userId];
        return user?.data ?? EMPTY_USER_DATA;
    });
}
```

---

## Checklist for New Selectors

When creating Zustand selectors:

- [ ] Does the selector return `{}` or `[]` in any code path?
- [ ] If yes, create a module-level constant for the fallback
- [ ] Does the selector compute a new object/array from state?
- [ ] If yes, consider if that computation should be memoized
- [ ] Test the selector with null/undefined inputs
- [ ] Test the selector with empty state
- [ ] Are all conditional branches returning stable references?

---

## Related Issues

This same pattern applies to:
- React Query selectors
- useMemo dependencies
- useEffect dependencies
- Any hook that compares references

**General Rule:** Never create new objects/arrays inline if they're used for reference comparison.
