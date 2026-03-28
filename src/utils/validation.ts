/**
 * Input validation utilities for EvoMap Hub.
 * Provides schema validation and type coercion for API request bodies.
 */

/**
 * Check if a value is a non-empty string.
 */
export function isString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

/**
 * Check if a value is a positive number (integer or float).
 */
export function isPositiveNumber(val: unknown): val is number {
  return typeof val === 'number' && !Number.isNaN(val) && val > 0;
}

/**
 * Check if a value is a non-negative number.
 */
export function isNonNegativeNumber(val: unknown): val is number {
  return typeof val === 'number' && !Number.isNaN(val) && val >= 0;
}

/**
 * Check if a value is a valid UUID v4 string.
 */
export function isUUID(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}

/**
 * Check if a value is a hex string (node_secret format).
 */
export function isHexString(val: unknown, expectedLen?: number): val is string {
  if (typeof val !== 'string') return false;
  const hexRegex = /^[0-9a-f]+$/i;
  if (!hexRegex.test(val)) return false;
  if (expectedLen !== undefined && val.length !== expectedLen) return false;
  return true;
}

/**
 * Validate required fields are present in an object.
 * Returns array of missing field names.
 */
export function requiredFields<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[]
): string[] {
  const missing: string[] = [];
  for (const f of fields) {
    const val = obj[f];
    if (!isString(val) && val !== 0 && val !== false && val !== null && val !== undefined) {
      missing.push(String(f));
    }
  }
  return missing;
}

/**
 * Coerce a value to an integer with optional bounds.
 */
export function toInt(val: unknown, defaultVal: number, min?: number, max?: number): number {
  const parsed = parseInt(String(val), 10);
  if (Number.isNaN(parsed)) return defaultVal;
  let result = parsed;
  if (min !== undefined) result = Math.max(result, min);
  if (max !== undefined) result = Math.min(result, max);
  return result;
}

/**
 * Validate ISO-8601 timestamp string.
 */
export function isISOTimestamp(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const d = new Date(val);
  return !Number.isNaN(d.getTime());
}

/**
 * Check if array is non-empty and all elements satisfy a predicate.
 */
export function isNonEmptyArray<T>(
  val: unknown,
  itemCheck?: (item: unknown) => item is T
): val is T[] {
  if (!Array.isArray(val) || val.length === 0) return false;
  if (itemCheck) return val.every(itemCheck);
  return true;
}

/**
 * Validate enum value.
 */
export function isEnum<T extends string>(val: unknown, allowed: readonly T[]): val is T {
  if (typeof val !== 'string') return false;
  return (allowed as readonly string[]).indexOf(val) >= 0;
}
