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
    <div className="w-full bg-[#1a1f2c] rounded-xl overflow-hidden flex flex-col h-full shadow-md">
      {/* Terminal Header */}
      <div className="bg-[#141824] px-4 py-3 flex items-center justify-between border-b border-slate-700/60 select-none">
        <div className="flex items-center gap-2 font-mono text-xs text-white">
          <Terminal className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-sm">Output Logs</span>
          {currentStepMessage && (
            <span className="text-xs text-amber-300 bg-[#242a3a] px-3 py-0.5 rounded-full font-mono font-bold">
              {currentStepMessage}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onClearLogs}
            className="p-1 text-slate-300 hover:text-amber-300 transition-colors"
            title="Clear Output"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Traffic Light Dots */}
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
        </div>
      </div>

      {/* Progress Bar (if running) */}
      <div className="px-4 py-2.5 bg-[#12151f] border-b border-slate-700/60">
        <div className="flex justify-between items-center text-xs font-mono mb-1">
          <span className="text-slate-300 font-medium">Pipeline Execution Progress</span>
          <span className="text-amber-300 font-bold">{progress}%</span>
        </div>
        <div className="w-full bg-[#242a3a] rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-amber-400 h-full rounded-full transition-all duration-300 shadow-md shadow-amber-400"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Log Body */}
      <div
        ref={logContainerRef}
        className="p-4 font-mono text-xs leading-relaxed text-slate-100 flex-1 overflow-y-auto space-y-1.5 bg-[#0b0e17]"
      >
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 italic select-none">
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
        {running && <div className="animate-pulse text-amber-400 font-bold">_</div>}
      </div>
    </div>
  );
};
