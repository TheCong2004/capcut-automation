import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Optional custom fallback renderer; receives the error + a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Called after the boundary catches — e.g. to log to telemetry. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

/**
 * Chặn lỗi render/effect của cây con để 1 lỗi (vd fetch :30000 fail lúc BE
 * chưa lên) không làm trắng/đen toàn app. Hiện fallback gọn + nút "Thử lại"
 * reset boundary để render lại cây con.
 */
export class BackendErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
    // eslint-disable-next-line no-console
    console.error("[BackendErrorBoundary]", error, info);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (error) {
      if (this.props.fallback) return this.props.fallback(error, this.reset);
      return <DefaultFallback error={error} onRetry={this.reset} />;
    }
    return this.props.children;
  }
}

function DefaultFallback({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
        minHeight: 160,
        textAlign: "center",
        color: "#e5e7eb",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600 }}>
        Phần này gặp lỗi
      </div>
      <div
        style={{
          fontSize: 13,
          opacity: 0.75,
          maxWidth: 420,
          wordBreak: "break-word",
        }}
      >
        {error.message || "Đã có lỗi không mong muốn."}
      </div>
      <button
        type="button"
        onClick={onRetry}
        style={{
          marginTop: 4,
          padding: "6px 16px",
          fontSize: 13,
          fontWeight: 500,
          color: "#fff",
          background: "#2563eb",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        Thử lại
      </button>
    </div>
  );
}

export default BackendErrorBoundary;
