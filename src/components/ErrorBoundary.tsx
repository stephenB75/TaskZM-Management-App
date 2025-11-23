import React, { Component, ErrorInfo, ReactNode } from 'react';

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
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
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
      // Try to recover by forcing a page reload after a short delay
      console.error('ErrorBoundary: Initialization error detected, attempting recovery', {
        error: error.message,
        componentStack: errorInfo.componentStack
      });
      
      // Set error state to show error UI
      this.setState({
        error,
        errorInfo,
      });
      
      // Attempt automatic recovery after 2 seconds
      setTimeout(() => {
        try {
          window.location.reload();
        } catch (reloadError) {
          console.error('Failed to reload page:', reloadError);
        }
      }, 2000);
      
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

