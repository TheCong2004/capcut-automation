import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { InkOSFrame } from "./InkOSFrame";
import { Loader2, RefreshCw } from "lucide-react";

type InkosState = "stopped" | "starting" | "ready" | "failed";

interface InkosResponse {
  status: string;
  ui_ready: boolean;
  api_ready: boolean;
  message?: string | null;
  error?: string | null;
}

const isTauri =
  typeof window !== "undefined" &&
  ("__TAURI__" in window || "__TAURI_INTERNALS__" in window);

export const PageInkOS: React.FC = () => {
  const [status, setStatus] = useState<InkosState>("starting");
  const [error, setError] = useState<string | null>(null);

  const handleStart = useCallback(async () => {
    setError(null);

    if (!isTauri) {
      setStatus("failed");
      setError("InkOS auto-start requires ArtCraft desktop mode.");
      return;
    }

    setStatus("starting");

    try {
      const res = await invoke<InkosResponse>("inkos_start_command");
      if (res.error) {
        setStatus("failed");
        setError(res.error);
      } else if (res.status === "ready" && res.ui_ready) {
        setStatus("ready");
      } else {
        setStatus("starting");
        let tries = 0;
        const poll = setInterval(async () => {
          tries++;
          try {
            const pollRes = await invoke<InkosResponse>("inkos_status_command");
            if (pollRes.ui_ready) {
              clearInterval(poll);
              setStatus("ready");
            }
          } catch {}
          if (tries > 20) {
            clearInterval(poll);
            setStatus("failed");
            setError("InkOS startup timed out waiting for port 4567.");
          }
        }, 1000);
      }
    } catch (err: any) {
      setStatus("failed");
      setError(err?.message || "Failed to start InkOS process");
    }
  }, []);

  useEffect(() => {
    handleStart();
  }, [handleStart]);

  if (status === "ready") {
    return (
      <div className="h-full w-full overflow-hidden">
        <InkOSFrame />
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#0f1015] p-6 text-slate-300">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-red-500/20 bg-[#161822] p-6 max-w-md text-center">
          <p className="text-xs text-red-400 font-medium leading-relaxed">{error || "InkOS startup failed"}</p>
          <button
            onClick={handleStart}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Thử lại</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#0f1015] text-slate-300">
      <div className="flex items-center gap-3 rounded-xl border border-purple-500/20 bg-[#161822] px-5 py-3 shadow-lg">
        <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
        <span className="text-xs font-medium text-slate-200">Starting InkOS...</span>
      </div>
    </div>
  );
};
