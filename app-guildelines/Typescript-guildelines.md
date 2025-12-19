# TypeScript Guidelines

## Core Principles

- **Type Safety First**: Leverage TypeScript's static typing to catch errors at compile time rather than runtime.
- **Explicit over Implicit**: Always prefer explicit type annotations where they improve code clarity.
- **Simplicity over Complexity**: Avoid overly complex type structures when simpler ones will suffice.
- **Consistency**: Maintain consistent typing patterns throughout the codebase.

## Generics

- Use generics to create reusable, type-safe components and functions
- Keep generic type names descriptive (avoid single-letter names except for simple cases)
- Constrain generic types when possible using the `extends` keyword
- Document complex generic structures with comments


## Best Practices

### Type Inference

- Let TypeScript infer types when it's clear and unambiguous
- Explicitly type complex objects, function parameters, and return types
- Always type function declarations, especially exported ones

### Enable `strict` Mode in `tsconfig.json`
- This ensures TypeScript performs full type-checking and catches issues early.
- Includes: `strictNullChecks`, `noImplicitAny`, `alwaysStrict`, etc.

### Avoid Using `any`
- `any` disables type checking—defeats the purpose of TypeScript.
- Use `unknown` when needed, then narrow down with type checks.
- If `any` is absolutely necessary, isolate and comment it.
- **Never cast types to `any`** (e.g., `as any`). This bypasses TypeScript's type checking completely and can lead to runtime errors.
- Instead, use proper type narrowing, type guards, or more specific type assertions when absolutely necessary.

### Always Type Function Parameters and Return Values
- Explicit types prevent bugs and make functions easier to understand.
- Especially important for exported or public functions.

### Use `type` and `interface` Appropriately
- Use `interface` for objects that might be extended or implemented.
- Use `type` for unions, intersections, or when composing complex types.
- Avoid mixing both for the same shape.

### Prefer Union Types Over Enums
- Use string literal unions (`'pending' | 'approved' | 'rejected'`) instead of enums when possible.
- They’re simpler, easier to infer, and fully type-safe.

### Use Generics to Create Reusable Types
- Avoid duplicating types by leveraging generics in functions, components, and utility types.
- Makes your code more flexible and type-safe.

### Avoid Type Assertions (`as`) Unless You’re Certain
- Type assertions can bypass the compiler and lead to runtime errors.
- Only use `as` when you’ve validated the value shape manually or through safe parsing.

### Use `readonly` for Immutable Data
- Protect values from accidental mutation by using `readonly` with arrays and objects.
- Improves predictability and safety.

### Narrow Types Before Using Them
- Use `typeof`, `instanceof`, or optional chaining to ensure values are safe before accessing them.
- Prevents runtime errors in loosely typed or third-party data.

### Keep Types Close to the Data They Describe
- If a type is only used in one file, define it there.
- Move it to a shared `types/` folder only when reused across multiple parts of the app.


### Keep Your `tsconfig` Clean and Strict
- Don’t disable important compiler options unless absolutely necessary.
- Keep configurations consistent across environments and projects.

### DO NOT Create COMPLEX TYPES
- Avoid creating complex types that are not immediately obvious.
- Use comments to explain why a type is structured a certain way, especially if it’s not obvious.
- Helps others (and future you) understand your decisions.
- Prefer simple, self-explanatory types.
