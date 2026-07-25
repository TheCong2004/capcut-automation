import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  override static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center p-8 bg-background">
          <div className="flex flex-col items-center gap-3 text-center max-w-md w-full rounded-md border border-border bg-card p-6">
            <div className="w-10 h-10 rounded-md border border-destructive/30 bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <h2 className="text-sm font-semibold tracking-tight">
              {this.props.fallbackTitle || 'Something went wrong'}
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {this.props.fallbackMessage ||
                'An unexpected error occurred. Try reloading this section.'}
            </p>
            {this.state.error ? (
              <pre className="w-full text-left text-[11px] text-muted-foreground bg-panel border border-border rounded-md p-3 max-h-32 overflow-auto font-mono">
                {this.state.error.message}
              </pre>
            ) : null}
            <Button onClick={this.handleReset} variant="outline" size="sm" className="gap-2 mt-1">
              <RefreshCw className="w-3.5 h-3.5" />
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
