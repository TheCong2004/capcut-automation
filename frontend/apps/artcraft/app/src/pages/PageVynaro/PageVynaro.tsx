import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { VynaroStatus, VynaroState } from "./VynaroStatus";
import { Film, Play, Square, ExternalLink, RefreshCw, Loader2 } from "lucide-react";

interface VynaroResponse {
  status: "running" | "stopped" | "starting";
  pid?: number | null;
  message?: string | null;
  error?: string | null;
}

const isTauri =
  typeof window !== "undefined" &&
  ("__TAURI__" in window || "__TAURI_INTERNALS__" in window);

export const PageVynaro: React.FC = () => {
  const [status, setStatus] = useState<VynaroState>("stopped");
  const [pid, setPid] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!isTauri) {
      setMessage("Running in browser dev mode (Tauri API simulated).");
      return;
    }
    try {
      const res = await invoke<VynaroResponse>("vynaro_status_command");
      setStatus(res.status);
      setPid(res.pid ?? null);
      if (res.message) setMessage(res.message);
      if (res.error) setError(res.error);
    } catch (err: any) {
      setError(err?.message || "Failed to check Vynaro status");
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    setStatus("starting");
    setMessage("Starting Vynaro process...");

    if (!isTauri) {
      setTimeout(() => {
        setStatus("running");
        setPid(12345);
        setMessage("Vynaro mock process running (Dev browser mode).");
        setLoading(false);
      }, 1000);
      return;
    }

    try {
      const res = await invoke<VynaroResponse>("vynaro_start_command");
      setStatus(res.status);
      setPid(res.pid ?? null);
      if (res.message) setMessage(res.message);
      if (res.error) setError(res.error);
    } catch (err: any) {
      setStatus("stopped");
      setError(err?.message || "Failed to start Vynaro");
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    setError(null);

    if (!isTauri) {
      setStatus("stopped");
      setPid(null);
      setMessage("Vynaro mock process stopped.");
      setLoading(false);
      return;
    }

    try {
      const res = await invoke<VynaroResponse>("vynaro_stop_command");
      setStatus(res.status);
      setPid(null);
      if (res.message) setMessage(res.message);
      if (res.error) setError(res.error);
    } catch (err: any) {
      setError(err?.message || "Failed to stop Vynaro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-56px)] w-full flex-col bg-[#0f1015]">
      {/* Sub-header bar */}
      <div className="flex h-12 w-full shrink-0 items-center justify-between border-b border-slate-800/80 bg-[#14151c] px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-500/20 text-pink-400 border border-pink-500/30">
            <Film className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white tracking-tight">
              Vynaro Studio
            </h2>
            <p className="text-[11px] text-slate-400">
              叙影 — AI Video Narration & Workflow Desktop App (Tauri 2 + Rust)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition disabled:opacity-50"
            title="Refresh status"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full flex flex-col items-center justify-center p-8 bg-[#0f1015] space-y-6">
        <VynaroStatus
          status={status}
          pid={pid}
          message={message}
          error={error}
        />

        <div className="flex items-center gap-4">
          {status === "stopped" ? (
            <button
              onClick={handleStart}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-medium text-xs transition shadow-lg shadow-pink-600/20 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4 fill-current" />
              )}
              <span>Start Vynaro</span>
            </button>
          ) : (
            <>
              <button
                onClick={handleStart}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition shadow-lg shadow-emerald-600/20 disabled:opacity-50"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Open Vynaro</span>
              </button>
              <button
                onClick={handleStop}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium text-xs transition disabled:opacity-50"
              >
                <Square className="h-4 w-4 fill-current" />
                <span>Stop Vynaro</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
