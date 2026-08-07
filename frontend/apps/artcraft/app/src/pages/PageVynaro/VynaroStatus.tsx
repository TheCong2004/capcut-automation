import React from "react";

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
    <div className="rounded-2xl border border-slate-800 bg-[#161822] p-6 max-w-lg w-full space-y-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div
            className={`h-3.5 w-3.5 rounded-full ${
              status === "running"
                ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse"
                : status === "starting"
                ? "bg-amber-500 animate-ping"
                : "bg-slate-500"
            }`}
          />
          <span className="text-sm font-semibold capitalize text-white">
            {status === "running"
              ? "Running"
              : status === "starting"
              ? "Starting..."
              : "Stopped"}
          </span>
        </div>
        {pid && (
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
            PID: {pid}
          </span>
        )}
      </div>

      {message && (
        <p className="text-xs text-slate-300 leading-relaxed">{message}</p>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
          <strong>Lỗi: </strong> {error}
        </div>
      )}
    </div>
  );
};
