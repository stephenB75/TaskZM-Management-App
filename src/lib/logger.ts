/**
 * Production-ready logging utility
 * Automatically suppresses logs in production, respects environment
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';

class Logger {
  private shouldLog(level: LogLevel): boolean {
    // In production, only log errors and warnings
    if (isProduction) {
      return level === 'error' || level === 'warn';
    }
    // In development, log everything
    return true;
  }

  debug(...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug('[DEBUG]', ...args);
    }
  }

  info(...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info('[INFO]', ...args);
    }
  }

  log(...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log('[LOG]', ...args);
    }
  }

  warn(...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn('[WARN]', ...args);
    }
  }

  error(...args: any[]): void {
    // Always log errors, even in production
    console.error('[ERROR]', ...args);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export type for TypeScript
export type { LogLevel };

