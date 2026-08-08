import React from 'react';
import { Plus, Save, Play, Square } from 'lucide-react';

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
    <header className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] bg-[#0b0e14]/95 px-4 py-3 pl-14 md:px-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
        {[
          ['CapCut', status.mateOnline],
          ['OmniRoute', status.omniOnline],
          ['Pipeline', status.rustPipelineOnline],
        ].map(([label, online]) => (
          <span key={String(label)} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1 font-medium">
            <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-green-500' : 'bg-zinc-600'}`} />
            {label}
          </span>
        ))}
        {activeDraftUrl && <span className="hidden max-w-48 truncate text-zinc-500 lg:inline">{activeDraftUrl}</span>}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onAddStep}
          className="floword-button floword-button-secondary text-zinc-200"
        >
          <Plus className="h-3.5 w-3.5" /> Configure
        </button>

        <button
          onClick={onSaveWorkflow}
          className="floword-button floword-button-secondary text-zinc-200"
        >
          <Save className="h-3.5 w-3.5" /> Save
        </button>

        {running ? (
          <button
            onClick={onRunWorkflow}
            className="floword-button bg-red-500 text-white hover:bg-red-600"
          >
            <Square className="h-3.5 w-3.5 fill-white" /> Stop
          </button>
        ) : (
          <button
            onClick={onRunWorkflow}
            className="floword-button floword-button-primary"
          >
            <Play className="h-3.5 w-3.5 fill-white" /> Run
          </button>
        )}
      </div>
    </header>
  );
};
