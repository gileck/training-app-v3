---
name: eslint-custom-guidelines
description: Custom ESLint rules and when to use disable comments. Use this when fixing lint issues.
title: ESLint Custom Rules
guidelines:
  - "Never use ESLint disable comments unless specifically instructed"
  - "Exception: `state-management/prefer-state-architecture` — add disable comment WITH explanation"
  - "Only 4 valid useState cases: text input, dialog open, in-flight submission, confirm dialog"
  - "All other UI state (filters, view mode, sort, tabs, collapsed sections) MUST use Zustand"
  - "Always run `yarn checks` after fixing lint issues"
priority: 4
---
# ESLint Custom Guidelines

## ESLint Disable Comments

- Do not use `// eslint-disable-next-line` or other ESLint disable comments unless specifically instructed by the user.
- **Exception**: `state-management/prefer-state-architecture` - See below.

## State Management Rule (`prefer-state-architecture`)

This rule warns on every `useState` usage to enforce conscious decision-making.

### When to Add Disable Comment

`useState` is only appropriate for **truly ephemeral** state that should reset on navigation. Add a disable comment WITH explanation:

```typescript
// eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog open state
const [isOpen, setIsOpen] = useState(false);

// eslint-disable-next-line state-management/prefer-state-architecture -- form input before submission
const [inputValue, setInputValue] = useState('');

// eslint-disable-next-line state-management/prefer-state-architecture -- in-flight submission indicator
const [isSubmitting, setIsSubmitting] = useState(false);

// eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral confirm dialog state
const [showConfirm, setShowConfirm] = useState(false);
```

### Valid Justifications (ONLY these 4)

- `form input before submission` — text input, search box
- `ephemeral dialog/modal open state` — dialog visibility that resets on navigate
- `in-flight submission indicator` — loading state tied to a single button click
- `ephemeral confirm dialog state` — one-shot confirmation prompts

### ❌ NOT Valid — Must Use Zustand

These are **not** ephemeral and must use Zustand (in-memory or persisted):

- View mode (list/grid) → Zustand persisted
- Filter/sort selections → Zustand persisted
- Collapsed/expanded sections → Zustand
- Selected tab → Zustand
- Toggle states (show completed, advanced options) → Zustand persisted
- Select mode / selected items → Zustand in-memory
- Any state the user expects to survive navigation

### When NOT to Use useState

If the warning triggers and none of the 4 valid cases apply:

- **API data** → Use React Query hooks
- **Everything else** → Use Zustand (`createStore`)

See `state-management-guidelines` for full details and examples.

## Post-Linting Verification

- After fixing any lint issue, ALWAYS run `yarn checks`.
- If `yarn checks` reports any further issues, fix all of them.
- Ensure `yarn checks` completes with no errors before considering the linting task complete.
