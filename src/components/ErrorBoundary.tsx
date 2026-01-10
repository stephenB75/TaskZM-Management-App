import React, { Component, ErrorInfo, ReactNode } from 'react';
import { TIMING_CONSTANTS } from '../lib/timing-constants';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  private reloadAttempted = false;
  private lastErrorTime = 0;
  private readonly RELOAD_COOLDOWN = TIMING_CONSTANTS.errorBoundary.reloadCooldown;
  private readonly MAX_RELOADS_PER_SESSION = TIMING_CONSTANTS.errorBoundary.maxReloadsPerSession;
  private readonly RELOAD_DELAY = TIMING_CONSTANTS.errorBoundary.reloadDelay;
  private reloadCount = 0;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
    
    // Check if we've already attempted reloads in this session
    const sessionReloadCount = sessionStorage.getItem('errorBoundaryReloadCount');
    if (sessionReloadCount) {
      this.reloadCount = parseInt(sessionReloadCount, 10) || 0;
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log all errors for debugging
    console.error('ErrorBoundary caught an error:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      name: error.name,
    });
    
    // DISABLED: Automatic reload is too disruptive and causes random refreshes
    // Only show error UI - let user manually refresh if needed
    // The error detection was too broad and caught non-critical errors
    
    // Set error state to show error UI
    this.setState({
      error,
      errorInfo,
    });
    
    // Log error to console for debugging but don't auto-reload
    console.warn('ErrorBoundary: Showing error UI. User can manually refresh if needed.');
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-background p-4">
          <div className="max-w-md w-full bg-white dark:bg-card rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">
              Something went wrong
            </h2>
            <p className="text-gray-600 dark:text-foreground mb-4">
              The application encountered an unexpected error. Please try refreshing the page.
            </p>
            {this.state.error && (
              <details className="mb-4">
                <summary className="cursor-pointer text-sm text-gray-500 dark:text-muted-foreground mb-2">
                  Error Details
                </summary>
                <pre className="text-xs bg-gray-100 dark:bg-muted p-2 rounded overflow-auto max-h-40">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleReset}
              className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full mt-2 px-4 py-2 bg-gray-200 dark:bg-muted text-gray-800 dark:text-foreground rounded-lg hover:bg-gray-300 dark:hover:bg-muted/80 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

