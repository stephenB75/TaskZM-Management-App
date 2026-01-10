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
    // Check if this is a known initialization error
    const isInitializationError = 
      error.message.includes("Cannot access") && 
      error.message.includes("before initialization");
    
    if (isInitializationError) {
      // This is an initialization error - could be from vendor or our code
      console.error('ErrorBoundary: Initialization error detected', {
        error: error.message,
        componentStack: errorInfo.componentStack,
        reloadCount: this.reloadCount,
        timeSinceLastError: Date.now() - this.lastErrorTime
      });
      
      // Set error state to show error UI
      this.setState({
        error,
        errorInfo,
      });
      
      // Prevent reload loops - check cooldown and max reloads
      const now = Date.now();
      const timeSinceLastError = now - this.lastErrorTime;
      
      // Only attempt reload if:
      // 1. We haven't already attempted a reload for this error
      // 2. Enough time has passed since last error (cooldown)
      // 3. We haven't exceeded max reloads per session
      if (!this.reloadAttempted && 
          timeSinceLastError > this.RELOAD_COOLDOWN && 
          this.reloadCount < this.MAX_RELOADS_PER_SESSION) {
        
        this.reloadAttempted = true;
        this.lastErrorTime = now;
        this.reloadCount++;
        
        // Store reload count in session storage to persist across reloads
        try {
          sessionStorage.setItem('errorBoundaryReloadCount', String(this.reloadCount));
        } catch (e) {
          // Ignore sessionStorage errors
        }
        
        console.warn(`ErrorBoundary: Attempting automatic recovery (${this.reloadCount}/${this.MAX_RELOADS_PER_SESSION})`);
        
        // Attempt automatic recovery after a delay (gives user time to see error)
        setTimeout(() => {
          try {
            // Clear the reload count if we're about to reload (fresh start)
            if (this.reloadCount >= this.MAX_RELOADS_PER_SESSION) {
              try {
                sessionStorage.removeItem('errorBoundaryReloadCount');
              } catch (e) {
                // Ignore
              }
            }
            window.location.reload();
          } catch (reloadError) {
            console.error('Failed to reload page:', reloadError);
            this.reloadAttempted = false; // Allow retry if reload failed
          }
        }, this.RELOAD_DELAY);
      } else {
        // Don't reload - show error UI instead
        if (this.reloadCount >= this.MAX_RELOADS_PER_SESSION) {
          console.warn('ErrorBoundary: Max reload attempts reached. Showing error UI instead.');
        } else if (timeSinceLastError <= this.RELOAD_COOLDOWN) {
          const secondsRemaining = Math.ceil((this.RELOAD_COOLDOWN - timeSinceLastError) / TIMING_CONSTANTS.timeConversions.secondsToMs);
          console.warn(`ErrorBoundary: Reload cooldown active (${secondsRemaining}s remaining). Showing error UI instead.`);
        }
      }
      
      return;
    }
    
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
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

