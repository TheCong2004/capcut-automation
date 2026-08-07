import React from 'react';
import { Layers, Plus, Save, Play, Square, CheckCircle2, AlertCircle, Cpu } from 'lucide-react';

interface FlowordHeaderProps {
  status: {
    mateOnline: boolean;
    omniOnline: boolean;
    rustPipelineOnline: boolean;
  };
  activeDraftUrl: string;
  running: boolean;
  onRunWorkflow: () => void;
  onSaveWorkflow: () => void;
  onAddStep: () => void;
}

export const FlowordHeader: React.FC<FlowordHeaderProps> = ({
  status,
  activeDraftUrl,
  running,
  onRunWorkflow,
  onSaveWorkflow,
  onAddStep,
}) => {
  return (
    <header
      style={{ backgroundColor: '#12141c', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}
      className="px-5 py-3 flex flex-wrap items-center justify-between gap-4 select-none font-sans text-slate-100 shrink-0"
    >
      {/* Brand & Engine Title */}
      <div className="flex items-center gap-3">
        <div
          style={{ backgroundColor: '#fbbf24', color: '#0f172a' }}
          className="w-9 h-9 rounded-xl font-bold flex items-center justify-center shadow-lg shadow-amber-500/20"
        >
          <Layers className="w-5 h-5" />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-base tracking-tight text-white font-mono">
              NEODONUT ENGINE
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              v4.2 PROD
            </span>
          </div>
          <p className="text-xs text-slate-300 font-sans">
            Linear DAG Workflow Engine & CapCut Desktop Automation
          </p>
        </div>
      </div>

      {/* Service Connection Badges */}
      <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
        <div className="flex items-center gap-1.5 bg-[#1a1e2b] px-3 py-1.5 rounded-xl border border-slate-800">
          <span className={`w-2 h-2 rounded-full ${status.mateOnline ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          <span className="text-slate-300">Mate Agent :30000</span>
          <span className={status.mateOnline ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
            {status.mateOnline ? 'OK' : 'OFFLINE'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 bg-[#1a1e2b] px-3 py-1.5 rounded-xl border border-slate-800">
          <Cpu className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-slate-300">OmniRoute Gateway</span>
          <span className={status.omniOnline ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
            {status.omniOnline ? 'READY' : 'STANDBY'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 bg-[#1a1e2b] px-3 py-1.5 rounded-xl border border-slate-800">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-slate-300">Pipeline Worker</span>
          <span className="text-emerald-400 font-bold">READY</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onAddStep}
          className="flex items-center gap-1.5 bg-[#1e2332] hover:bg-[#282e42] text-slate-200 px-3 py-1.5 rounded-xl text-xs font-mono transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-amber-400" /> Configure Flow
        </button>

        <button
          onClick={onSaveWorkflow}
          className="flex items-center gap-1.5 bg-[#1e2332] hover:bg-[#282e42] text-slate-200 px-3 py-1.5 rounded-xl text-xs font-mono transition-colors"
        >
          <Save className="w-3.5 h-3.5 text-emerald-400" /> Save Workflow
        </button>

        {running ? (
          <button
            onClick={onRunWorkflow}
            className="flex items-center gap-1.5 bg-rose-500 hover:bg-rose-600 text-white px-4 py-1.5 rounded-xl text-xs font-mono font-bold transition-colors shadow-md"
          >
            <Square className="w-3.5 h-3.5 fill-white" /> Stop Pipeline
          </button>
        ) : (
          <button
            onClick={onRunWorkflow}
            style={{ backgroundColor: '#fbbf24', color: '#0f172a' }}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-mono font-bold transition-all shadow-md hover:bg-amber-300"
          >
            <Play className="w-3.5 h-3.5 fill-slate-950" /> Execute Plan
          </button>
        )}
      </div>
    </header>
  );
};
