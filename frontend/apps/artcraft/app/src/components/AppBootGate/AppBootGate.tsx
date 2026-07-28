import { ReactNode, useEffect, useState } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { pingBackend } from "~/pages/PageCapCutAutomation/api/capcutBeClient";

// Startup gate: the WebView boots before the capcut-mate backend (:30000) is
// ready, which can surface as a runtime script error / black screen. This gate
// holds a splash until Rust emits "backend://ready", shows an error + retry on
// "backend://error", and falls back to entering the app after a timeout so a
// dev run without a backend never gets stuck on the splash.

const isTauri =
  typeof window !== "undefined" &&
  ("__TAURI__" in window || "__TAURI_INTERNALS__" in window);

const READY_EVENT = "backend://ready";
const ERROR_EVENT = "backend://error";
const TIMEOUT_MS = 20000;

type ReadyPayload = { port: number };
type ErrorPayload = { message: string };

type Status = "waiting" | "ready" | "error" | "timeout";

export function AppBootGate({ children }: { children: ReactNode }) {
  // Non-Tauri (browser dev) never receives backend events — enter directly.
  const [status, setStatus] = useState<Status>(isTauri ? "waiting" : "ready");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isTauri) return;

    setStatus("waiting");
    setErrorMessage(null);

    let cancelled = false;
    let unlistenReady: Promise<UnlistenFn> | null = null;
    let unlistenError: Promise<UnlistenFn> | null = null;

    unlistenReady = listen<ReadyPayload>(READY_EVENT, () => {
      if (!cancelled) setStatus("ready");
    });
    unlistenError = listen<ErrorPayload>(ERROR_EVENT, (event) => {
      if (cancelled) return;
      setErrorMessage(event.payload?.message ?? "Backend failed to start");
      setStatus("error");
    });

    // Rust emits "backend://ready" from a background thread that can fire
    // BEFORE this effect registers its listener — most notably the reuse path,
    // which emits the instant the port is already open (the common happy path
    // when the BE is already running). Without an active probe, that missed
    // event would strand the fastest machines on the splash until TIMEOUT_MS.
    // Probe once on mount so an already-up backend enters the app immediately.
    void pingBackend({ retries: 0 }).then((online) => {
      if (!cancelled && online) setStatus("ready");
    });

    const timeoutId = window.setTimeout(() => {
      if (!cancelled) setStatus((s) => (s === "waiting" ? "timeout" : s));
    }, TIMEOUT_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      if (unlistenReady) unlistenReady.then((f) => f && f()).catch(() => {});
      if (unlistenError) unlistenError.then((f) => f && f()).catch(() => {});
    };
  }, [attempt]);

  // When in timeout/degraded mode, periodically probe backend to auto-clear banner
  useEffect(() => {
    if (status !== "timeout") return;
    const interval = setInterval(() => {
      void pingBackend({ retries: 0 }).then((online) => {
        if (online) setStatus("ready");
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [status]);

  if (status === "ready" || status === "timeout") {
    return (
      <>
        {status === "timeout" && (
          <div className="fixed left-1/2 top-3 z-[10000] -translate-x-1/2 rounded-lg bg-yellow-500/90 px-4 py-2 text-sm text-black shadow-lg">
            Backend not detected — running in degraded mode.
          </div>
        )}
        {children}
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black text-white">
      {status === "error" ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="text-lg font-semibold">Backend failed to start</div>
          <div className="max-w-md text-sm opacity-70">{errorMessage}</div>
          <button
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <div className="text-sm opacity-70">Starting…</div>
        </div>
      )}
    </div>
  );
}
