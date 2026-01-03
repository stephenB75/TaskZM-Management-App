/**
 * Error Utilities
 * 
 * Centralized error message extraction and formatting utilities
 */

/**
 * Extract error message from unknown error type
 * Handles Error objects, strings, and other error formats
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    const errorObj = error as Record<string, unknown>;
    if (errorObj.message && typeof errorObj.message === 'string') {
      return errorObj.message;
    }
    if (errorObj.error && typeof errorObj.error === 'string') {
      return errorObj.error;
    }
    try {
      const jsonStr = JSON.stringify(errorObj, Object.getOwnPropertyNames(errorObj));
      if (jsonStr && jsonStr !== '{}') {
        return jsonStr;
      }
    } catch {
      // Ignore stringify errors
    }
  }
  return 'An unexpected error occurred';
}

/**
 * Create user-friendly error message from error
 * Maps technical errors to user-friendly messages
 */
export function getUserFriendlyErrorMessage(error: unknown, defaultMessage: string): string {
  const errorMessage = getErrorMessage(error).toLowerCase();
  
  if (errorMessage.includes('already') || errorMessage.includes('exists')) {
    return 'This already exists. Please try again in a moment.';
  }
  if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('connection')) {
    return 'Network error. Please check your connection and try again.';
  }
  if (errorMessage.includes('permission') || errorMessage.includes('unauthorized') || errorMessage.includes('forbidden')) {
    return 'You do not have permission to perform this action.';
  }
  if (errorMessage.includes('not found') || errorMessage.includes('404')) {
    return 'The requested item was not found.';
  }
  if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
    return 'The request timed out. Please try again.';
  }
  
  return defaultMessage;
}

