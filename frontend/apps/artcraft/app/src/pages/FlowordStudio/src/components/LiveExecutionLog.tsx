import React, { useRef, useEffect } from 'react';
import { Terminal, Trash2 } from 'lucide-react';

interface LiveExecutionLogProps {
  logs: string[];
  running: boolean;
  progress: number;
  currentStepMessage?: string;
  onClearLogs: () => void;
}

export const LiveExecutionLog: React.FC<LiveExecutionLogProps> = ({
  logs,
  running,
  progress,
  currentStepMessage,
  onClearLogs,
}) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="floword-card flex h-full w-full flex-col overflow-hidden">
      {/* Terminal Header */}
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2 text-xs text-white">
          <Terminal className="h-4 w-4 text-zinc-500" />
          <span className="text-sm font-semibold">Output Logs</span>
          {currentStepMessage && (
            <span className="hidden max-w-56 truncate rounded-full bg-white/[0.05] px-3 py-1 font-mono text-[10px] text-zinc-500 xl:inline">
              {currentStepMessage}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onClearLogs}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200"
            title="Clear Output"
          >
            <Trash2 className="w-4 h-4" />
          </button>

        </div>
      </div>

      {/* Progress Bar (if running) */}
      <div className="border-b border-white/[0.08] bg-white/[0.015] px-4 py-2.5">
        <div className="flex justify-between items-center text-xs font-mono mb-1">
          <span className="font-medium text-zinc-400">Pipeline progress</span>
          <span className="font-semibold text-zinc-300">{progress}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-[#6366f1]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Log Body */}
      <div
        ref={logContainerRef}
        className="flex-1 space-y-1.5 overflow-y-auto bg-[#080b11] p-4 font-mono text-xs leading-relaxed text-zinc-300"
      >
        {logs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-zinc-600">
            [System ready] Click "Execute Workflow" to start pipeline DAG.
          </div>
        ) : (
          logs.map((line, index) => {
            let textColor = 'text-slate-100';
            if (line.includes('▶') || line.includes('Spawning')) textColor = 'text-amber-300 font-bold';
            if (line.includes('✓') || line.includes('COMPLETE') || line.includes('[10b981]')) textColor = 'text-emerald-300 font-bold';
            if (line.includes('❌') || line.includes('FAILED') || line.includes('Error')) textColor = 'text-rose-400 font-bold';

            return (
              <div key={index} className={`whitespace-pre-wrap break-all ${textColor}`}>
                {line}
              </div>
            );
          })
        )}
        {running && <div className="font-bold text-blue-400">_</div>}
      </div>
    </div>
  );
};
