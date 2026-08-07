import React from 'react';
import { Layers, CheckCircle2, Loader2, Clock, Play } from 'lucide-react';

export interface NeoStep {
  id: string;
  stepNumber: number;
  title: string;
  subtitle: string;
  description: string;
  imageUrl?: string;
  status: 'completed' | 'running' | 'pending' | 'failed' | 'skipped';
  actionKey?: string;
  functions: string[];
  selectedFunction: string;
}

interface FlowordPipelineVisualizerProps {
  steps: NeoStep[];
  activeStepIndex: number;
  selectedStepId: string;
  running: boolean;
  onSelectStep: (stepId: string) => void;
}

export const FlowordPipelineVisualizer: React.FC<FlowordPipelineVisualizerProps> = ({
  steps,
  activeStepIndex,
  selectedStepId,
  running,
  onSelectStep,
}) => {
  return (
    <div className="space-y-3 select-none font-sans">
      <div className="flex items-center justify-between font-mono text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-white uppercase tracking-wider text-xs">
            Module Pipeline DAG (6 Node Stages)
          </span>
        </div>
        <span className="text-slate-400 text-[11px]">
          Click card to inspect sub-interface & physical artifact details
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {steps.map((step, idx) => {
          const isSelected = selectedStepId === step.id;
          const isActiveNode = running && activeStepIndex === idx;
          const isCompleted = step.status === 'completed';

          return (
            <div
              key={step.id}
              onClick={() => onSelectStep(step.id)}
              style={{
                backgroundColor: isSelected ? '#1e2433' : '#181b24',
                border: isActiveNode
                  ? '1.5px solid #fbbf24'
                  : isSelected
                  ? '1px solid rgba(251, 191, 36, 0.4)'
                  : '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: isActiveNode
                  ? '0 0 16px rgba(251, 191, 36, 0.25)'
                  : isSelected
                  ? '0 0 10px rgba(0, 0, 0, 0.3)'
                  : 'none',
              }}
              className="rounded-2xl p-4 cursor-pointer transition-all duration-200 flex flex-col justify-between relative overflow-hidden group hover:border-slate-600"
            >
              {/* Optional Header Image Thumbnail */}
              {step.imageUrl && (
                <div className="relative h-24 w-full -mt-4 -mx-4 mb-3 overflow-hidden rounded-t-2xl border-b border-slate-800">
                  <img
                    src={step.imageUrl}
                    alt={step.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#181b24] via-transparent to-black/30" />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-amber-300 font-mono font-bold text-[10px] border border-amber-500/30">
                    Step #{step.stepNumber}
                  </span>
                </div>
              )}

              {/* Card Header & Status Badge */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    {!step.imageUrl && (
                      <span className="w-5 h-5 rounded-md bg-amber-400/20 text-amber-300 font-mono font-bold text-xs flex items-center justify-center border border-amber-400/30">
                        #{step.stepNumber}
                      </span>
                    )}
                    <h3 className="font-bold text-white text-sm tracking-tight truncate">
                      [{step.title}]
                    </h3>
                  </div>

                  {isActiveNode ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold flex items-center gap-1 shrink-0 animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                      RUNNING
                    </span>
                  ) : isCompleted ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      READY
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-mono font-bold flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3 text-slate-400" />
                      READY
                    </span>
                  )}
                </div>

                <p className="text-xs text-amber-300/90 font-mono font-semibold mb-1">
                  {step.subtitle}
                </p>

                <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed font-sans mb-3">
                  {step.description}
                </p>
              </div>

              {/* Selected Function Tag */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between font-mono text-[11px]">
                <span className="text-slate-400 truncate max-w-[200px]" title={step.selectedFunction}>
                  Fn: {step.selectedFunction || step.functions[0]}
                </span>
                <span className="text-amber-400/80 text-[10px] font-bold group-hover:text-amber-300 transition-colors">
                  Detail &rarr;
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
