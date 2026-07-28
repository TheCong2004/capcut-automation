import { Component, ErrorInfo, ReactNode } from "react";

// Catches render-time errors from the app subtree (including failures that
// surface when the capcut-mate backend is unavailable) and shows a retry
// affordance instead of a black screen. Pairs with AppBootGate, which handles
// the startup handshake via "backend://ready" / "backend://error".

type Props = { children: ReactNode };

type State = { error: Error | null };

export class BackendErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("BackendErrorBoundary caught an error", error, info);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  override render() {
    const { error } = this.state;

    if (!error) {
      return this.props.children;
    }

    return (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="text-lg font-semibold">Something went wrong</div>
          <div className="max-w-md text-sm opacity-70">{error.message}</div>
          <button
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20"
            onClick={this.handleRetry}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
}
