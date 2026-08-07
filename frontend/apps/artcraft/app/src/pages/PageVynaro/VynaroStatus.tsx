import React from "react";
import { Film, Info } from "lucide-react";

export type VynaroState = "stopped" | "starting" | "running";

interface VynaroStatusProps {
  status: VynaroState;
  pid?: number | null;
  message?: string | null;
  error?: string | null;
}

export const VynaroStatus: React.FC<VynaroStatusProps> = ({
  status,
  pid,
  message,
  error,
}) => {
  return (
    <div className="rounded-2xl border border-pink-500/20 bg-[#161822] p-8 max-w-lg w-full space-y-5 shadow-2xl">
      <div className="flex justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
          <Film className="h-7 w-7" />
        </div>
      </div>

      <div className="text-center space-y-1">
        <h3 className="text-lg font-bold text-white">Vynaro Studio</h3>
        <p className="text-xs text-slate-400">
          叙影 — AI Video Narration & Workflow Desktop Application
        </p>
      </div>

      <div className="flex items-center justify-between border-y border-slate-800/80 py-3 px-2">
        <div className="flex items-center gap-3">
          <div
            className={`h-3 w-3 rounded-full ${
              status === "running"
                ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse"
                : status === "starting"
                ? "bg-amber-500 animate-ping"
                : "bg-slate-500"
            }`}
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-white">
            {status === "running"
              ? "Running"
              : status === "starting"
              ? "Starting..."
              : "Stopped"}
          </span>
        </div>
        {pid && (
          <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
            PID: {pid}
          </span>
        )}
      </div>

      <div className="flex items-start gap-2.5 rounded-xl bg-slate-900/60 p-3.5 border border-slate-800 text-xs text-slate-400 leading-relaxed">
        <Info className="h-4 w-4 text-pink-400 shrink-0 mt-0.5" />
        <span>Vynaro runs in its own desktop window.</span>
      </div>

      {message && (
        <p className="text-xs text-slate-400 text-center leading-relaxed">{message}</p>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-red-400 text-center">
          <strong>Error: </strong> {error}
        </div>
      )}
    </div>
  );
};
