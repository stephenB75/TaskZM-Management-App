/**
 * Context Hook Utilities
 * 
 * Provides a consistent pattern for creating context hooks with type-safe defaults
 * and consistent error handling across all contexts.
 */

import React from 'react';

/**
 * Creates a type-safe context hook with consistent error handling
 * 
 * @param context - The React context to use
 * @param createDefault - Factory function to create default values
 * @param contextName - Name of the context for error messages
 * @returns A hook function that returns the context value or default
 * 
 * @example
 * ```typescript
 * export const useMyContext = createContextHook(
 *   MyContext,
 *   createDefaultMyContext,
 *   'MyContext'
 * );
 * ```
 */
export function createContextHook<T>(
  context: React.Context<T | undefined>,
  createDefault: () => T,
  contextName: string
): () => T {
  return () => {
    const contextValue = React.useContext(context);
    
    if (contextValue === undefined) {
      // During React Fast Refresh (HMR), providers can temporarily unmount
      // Return a safe default instead of throwing to prevent crashes
      if (import.meta.env.DEV) {
        console.warn(
          `use${contextName} called outside ${contextName}Provider (likely HMR issue), returning default`
        );
        return createDefault();
      }
      throw new Error(`use${contextName} must be used within ${contextName}Provider`);
    }
    
    return contextValue;
  };
}

/**
 * Creates a context hook that allows optional usage (returns default if not in provider)
 * 
 * @param context - The React context to use
 * @param createDefault - Factory function to create default values
 * @param contextName - Name of the context for warnings
 * @returns A hook function that returns the context value or default (never throws)
 * 
 * @example
 * ```typescript
 * export const useOptionalContext = createOptionalContextHook(
 *   OptionalContext,
 *   createDefaultOptionalContext,
 *   'OptionalContext'
 * );
 * ```
 */
export function createOptionalContextHook<T>(
  context: React.Context<T | undefined>,
  createDefault: () => T,
  contextName: string
): () => T {
  return () => {
    const contextValue = React.useContext(context);
    
    if (contextValue === undefined) {
      if (import.meta.env.DEV) {
        console.warn(
          `use${contextName} called outside ${contextName}Provider, returning default`
        );
      }
      return createDefault();
    }
    
    return contextValue;
  };
}

