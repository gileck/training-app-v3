# ESLint Plugin: State Management

Custom ESLint rules to enforce proper state management patterns for PWA offline-first applications.

## Rules

### `prefer-state-architecture`

Warns when `useState` is used without explicit justification. This forces developers to consciously choose between:

- **React Query** - For server state (API data)
- **Zustand** - For persistent client state (settings, auth hints)
- **useState** - For ephemeral UI state (modals, form inputs)

## Usage

When you see the warning, ask yourself:

1. **Is this data from an API?** → Use React Query
2. **Should this persist across app restarts?** → Use Zustand
3. **Is this temporary UI state?** → Use `useState` with a disable comment

## Suppressing the Warning

Add a disable comment with your justification:

```typescript
// eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral modal state
const [isOpen, setIsOpen] = useState(false);

// eslint-disable-next-line state-management/prefer-state-architecture -- form input before submission
const [inputValue, setInputValue] = useState('');

// eslint-disable-next-line state-management/prefer-state-architecture -- local loading indicator
const [isSubmitting, setIsSubmitting] = useState(false);
```

## Valid Justifications

Good reasons to use `useState`:

- `ephemeral modal/dialog state`
- `form input before submission`
- `local loading indicator`
- `accordion/expand state`
- `hover/focus state`
- `local error display`
- `temporary snackbar/toast`

## Invalid Justifications

These should use React Query or Zustand instead:

- ❌ "storing API data" → Use React Query
- ❌ "user preferences" → Use Zustand
- ❌ "data fetching state" → Use React Query's `isLoading`
- ❌ "filter state that should persist" → Use Zustand

