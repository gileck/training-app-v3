---
name: eslint-custom-guidelines
description: when fixing eslint issues
---
# ESLint Custom Guidelines

## ESLint Disable Comments

- Do not use `// eslint-disable-next-line` or other ESLint disable comments unless specifically instructed by the user.
- **Exception**: `state-management/prefer-state-architecture` - See below.

## State Management Rule (`prefer-state-architecture`)

This rule warns on every `useState` usage to enforce conscious decision-making.

### When to Add Disable Comment

If `useState` is appropriate (ephemeral UI state), add a disable comment WITH explanation:

```typescript
// eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral modal state
const [isOpen, setIsOpen] = useState(false);

// eslint-disable-next-line state-management/prefer-state-architecture -- form input before submission  
const [inputValue, setInputValue] = useState('');

// eslint-disable-next-line state-management/prefer-state-architecture -- local loading indicator
const [isSubmitting, setIsSubmitting] = useState(false);
```

### Valid Justifications

- `ephemeral modal/dialog state`
- `form input before submission`
- `local loading indicator`
- `accordion/expand state`
- `hover/focus state`
- `local error display`
- `temporary snackbar/toast`

### When NOT to Use useState

If the warning triggers and none of the above apply, consider:

- **API data** → Use React Query hooks
- **User preferences** → Use Zustand (`useSettingsStore`)
- **Auth state** → Use Zustand (`useAuthStore`)
- **Persistent UI state** → Use Zustand (`useUIStore`)

See `state-management-guidelines.mdc` for full details.

## Post-Linting Verification

- After fixing any lint issue, ALWAYS run `yarn checks`.
- If `yarn checks` reports any further issues, fix all of them.
- Ensure `yarn checks` completes with no errors before considering the linting task complete.
