import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Film, Play, Square, Loader2, ExternalLink } from "lucide-react";

interface VynaroResponse {
  status: "running" | "stopped" | "starting" | "failed";
  pid?: number | null;
  message?: string | null;
  error?: string | null;
}

const isTauri =
  typeof window !== "undefined" &&
  ("__TAURI__" in window || "__TAURI_INTERNALS__" in window);

export const PageVynaro: React.FC = () => {
  const [status, setStatus] = useState<"stopped" | "starting" | "running" | "failed">("stopped");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    if (!isTauri) return;
    try {
      const res = await invoke<VynaroResponse>("vynaro_status_command");
      if (res.status === "running") {
        setStatus("running");
      } else if (res.status === "stopped" && status !== "starting") {
        setStatus("stopped");
      }
    } catch {}
  }, [status]);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 2500);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const handleOpen = async () => {
    if (!isTauri) {
      setError("Vynaro requires ArtCraft desktop mode.");
      return;
    }
    setLoading(true);
    setError(null);
    if (status !== "running") {
      setStatus("starting");
    }

    try {
      const res = await invoke<VynaroResponse>("vynaro_open_command");
      if (res.error) {
        setStatus("failed");
        setError(res.error);
      } else if (res.status === "running") {
        setStatus("running");
      } else {
        setStatus("starting");
      }
    } catch (err: any) {
      setStatus("failed");
      setError(err?.message || "Unable to open Vynaro");
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    if (!isTauri) return;
    setLoading(true);
    try {
      await invoke("vynaro_stop_command");
      setStatus("stopped");
    } catch (err: any) {
      setError(err?.message || "Failed to stop Vynaro");
    } finally {
      setLoading(false);
    }
  };

  if (!isTauri) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#0f1015] p-6 text-slate-300">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-800 bg-[#161822] p-6 max-w-sm text-center">
          <Film className="h-6 w-6 text-pink-400" />
          <h3 className="text-sm font-bold text-white">Vynaro</h3>
          <p className="text-xs text-slate-400">
            Vynaro requires ArtCraft desktop mode.
          </p>
        </div>
      </div>
    );
  }

  if (status === "starting") {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#0f1015] p-6 text-slate-300">
        <div className="flex items-center gap-3 rounded-xl border border-pink-500/20 bg-[#161822] px-5 py-3 shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin text-pink-400" />
          <span className="text-xs font-medium text-slate-200">Opening Vynaro...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#0f1015] p-6 text-slate-300">
      {status !== "running" ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-14 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
            <Film className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Vynaro</h3>
            <p className="text-xs text-slate-400 mt-1">
              叙影 — AI Video Narration & Workflow Desktop Application
            </p>
          </div>
          {error && <p className="text-xs text-red-400 max-w-md font-medium leading-relaxed">{error}</p>}
          <button
            onClick={handleOpen}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-medium text-xs transition shadow-lg shadow-pink-600/20 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
            <span>Open Vynaro</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Film className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Vynaro is open</h3>
            <p className="text-xs text-slate-400 mt-1">
              Vynaro is open in its desktop window.
            </p>
          </div>
          {error && <p className="text-xs text-red-400 max-w-md font-medium leading-relaxed">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpen}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition shadow-lg shadow-emerald-600/20 disabled:opacity-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Bring to front</span>
            </button>
            <button
              onClick={handleStop}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium text-xs transition disabled:opacity-50"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              <span>Stop Vynaro</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
