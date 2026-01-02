/**
 * Type Guard Utilities
 * 
 * Provides type guard functions for safely narrowing union types and checking
 * object shapes. These guards enable safe property access on potentially
 * union-typed values.
 */

import type { RolloverSettings, HoursSettings } from '../types';

/**
 * Type guard for RolloverSettings
 * Checks if a value has the correct shape for RolloverSettings interface
 * 
 * @param value - The value to check
 * @returns true if value is RolloverSettings, false otherwise
 */
export function isRolloverSettings(
  value: RolloverSettings | { enabled?: boolean; maxHours?: number } | unknown
): value is RolloverSettings {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  
  // Check for RolloverSettings properties
  return 'autoRollover' in value && 'askBeforeRolling' in value;
}

/**
 * Type guard for HoursSettings
 * Checks if a value has the correct shape for HoursSettings interface
 * 
 * @param value - The value to check
 * @returns true if value is HoursSettings, false otherwise
 */
export function isHoursSettings(value: unknown): value is HoursSettings {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  
  // Check for required HoursSettings properties
  return (
    'weekdayHours' in value &&
    'weekendHours' in value &&
    'respectHours' in value &&
    typeof (value as HoursSettings).respectHours === 'boolean'
  );
}

/**
 * Type guard to check if an object has a specific property
 * 
 * @param obj - The object to check
 * @param prop - The property name to check for
 * @returns true if the object has the property, false otherwise
 */
export function hasProperty<T extends string>(
  obj: unknown,
  prop: T
): obj is Record<T, unknown> {
  return typeof obj === 'object' && obj !== null && prop in obj;
}

/**
 * Type guard to check if a value is not null or undefined
 * 
 * @param value - The value to check
 * @returns true if value is not null or undefined, false otherwise
 */
export function isNotNullOrUndefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard to check if a value is a non-empty string
 * 
 * @param value - The value to check
 * @returns true if value is a non-empty string, false otherwise
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard to check if a value is a number
 * 
 * @param value - The value to check
 * @returns true if value is a number, false otherwise
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Type guard to check if a value is an array
 * 
 * @param value - The value to check
 * @returns true if value is an array, false otherwise
 */
export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

