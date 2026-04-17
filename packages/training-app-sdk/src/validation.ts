import { TrainingAppValidationError } from './errors';

/**
 * Lightweight runtime input validators.
 *
 * These run in the SDK before any network call, converting bad arguments into
 * {@link TrainingAppValidationError} with a useful field path. They exist to
 * catch programmer mistakes early — not to replace server-side validation.
 *
 * They're deliberately minimal: no Zod, no schemas. If you need richer
 * validation, apply it at your call site.
 */

export function assertNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new TrainingAppValidationError(field, `must be a string (got ${describe(value)})`);
  }
  if (value.length === 0) {
    throw new TrainingAppValidationError(field, 'must be a non-empty string');
  }
}

export function assertPositiveNumber(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TrainingAppValidationError(field, `must be a finite number (got ${describe(value)})`);
  }
  if (value <= 0) {
    throw new TrainingAppValidationError(field, 'must be > 0');
  }
}

export function assertNonNegativeInteger(
  value: unknown,
  field: string,
): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new TrainingAppValidationError(field, `must be a non-negative integer (got ${describe(value)})`);
  }
}

export function assertOneOf<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  field: string,
): asserts value is T[number] {
  if (typeof value !== 'string' || !allowed.includes(value as T[number])) {
    throw new TrainingAppValidationError(
      field,
      `must be one of [${allowed.join(', ')}] (got ${describe(value)})`,
    );
  }
}

export function assertObject(value: unknown, field: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TrainingAppValidationError(field, `must be an object (got ${describe(value)})`);
  }
}

export function assertArray<T = unknown>(
  value: unknown,
  field: string,
  minLength = 0,
): asserts value is T[] {
  if (!Array.isArray(value)) {
    throw new TrainingAppValidationError(field, `must be an array (got ${describe(value)})`);
  }
  if (value.length < minLength) {
    throw new TrainingAppValidationError(field, `must have at least ${minLength} item(s)`);
  }
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return `array(length=${value.length})`;
  return typeof value;
}
