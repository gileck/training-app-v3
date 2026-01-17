# React Rendering Guidelines

This document covers common React rendering pitfalls that cause infinite loops, performance issues, and hard-to-debug bugs. These issues often pass TypeScript and ESLint checks but fail at runtime.

---

## Zustand Selector Stability

### The Problem

Zustand selectors that return new object/array references on every render cause infinite re-render loops. This happens because React's `useSyncExternalStore` detects a "change" when the reference changes, even if the content is identical.

**Symptoms:**
- `Maximum update depth exceeded` error
- `The result of getSnapshot should be cached to avoid an infinite loop` warning
- App freezes or crashes on component mount

### Bad Pattern

```typescript
// BAD: Returns new {} on every render when planId is null or data is missing
export function useWeekWorkoutSets(planId: string | null, weekNumber: number) {
    return usePlanDataStore((state) => {
        if (!planId) return {};  // New object every time!
        return state.plans[planId]?.workoutSets?.[weekNumber] ?? {};  // New object every time!
    });
}
```

### Good Pattern

```typescript
// GOOD: Use stable fallback references
const EMPTY_WORKOUT_SETS: Record<string, Record<string, number>> = {};

export function useWeekWorkoutSets(planId: string | null, weekNumber: number) {
    return usePlanDataStore((state) => {
        if (!planId) return EMPTY_WORKOUT_SETS;  // Same reference every time
        return state.plans[planId]?.workoutSets?.[weekNumber] ?? EMPTY_WORKOUT_SETS;
    });
}
```

### Rules

1. **Never return `{}` or `[]` literals** in selector fallback paths
2. **Create module-level constants** for empty fallback values
3. **Name them clearly**: `EMPTY_ITEMS`, `EMPTY_MAP`, `EMPTY_LIST`
4. **Place constants near selectors** in the same file for visibility

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

## Checklist for New Selectors

When creating Zustand selectors:

- [ ] Does the selector return `{}` or `[]` in any code path?
- [ ] If yes, create a module-level constant for the fallback
- [ ] Does the selector compute a new object/array from state?
- [ ] If yes, consider if that computation should be memoized
- [ ] Test the selector with null/undefined inputs
- [ ] Test the selector with empty state
