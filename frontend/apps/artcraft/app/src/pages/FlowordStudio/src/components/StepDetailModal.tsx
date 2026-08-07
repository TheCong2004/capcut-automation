import React, { useState } from 'react';
import { StepRun, ArtifactRef } from '../services/workflowEngine';
import { X, Info, FileJson, Terminal, FolderOpen, Globe, AlertTriangle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface StepDetailModalProps {
  step: StepRun;
  onClose: () => void;
  onRetryStep: (stepId: string) => void;
}

export const StepDetailModal: React.FC<StepDetailModalProps> = ({
  step,
  onClose,
  onRetryStep,
}) => {
  const [tab, setTab] = useState<'overview' | 'input' | 'logs' | 'output' | 'artifacts' | 'cdp' | 'errors'>('overview');

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none font-sans">
      <div
        style={{ backgroundColor: '#1a1e28', border: '1px solid rgba(255, 255, 255, 0.12)' }}
        className="w-full max-w-3xl rounded-2xl p-5 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-slate-100"
      >
        {/* Header */}
        <div style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} className="flex items-center justify-between pb-3 mb-3 border-b">
          <div className="flex items-center gap-2.5">
            <span
              style={{ backgroundColor: '#fbbf24', color: '#0f172a' }}
              className="w-7 h-7 rounded-lg font-bold text-xs font-mono flex items-center justify-center"
            >
              #{step.stepNumber}
            </span>
            <div>
              <h3 className="font-bold text-base text-white">
                Module #{step.stepNumber}: [{step.title}] — Sub-Interface Detail
              </h3>
              <p className="text-xs text-slate-300">Chức năng: {step.selectedFunction || step.functions[0]}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-[#242a3a] rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1 bg-[#12151e] p-1.5 rounded-xl mb-4 text-xs font-mono overflow-x-auto shrink-0">
          {(['overview', 'input', 'logs', 'output', 'artifacts', 'cdp', 'errors'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg font-bold uppercase transition-all shrink-0 ${
                tab === t ? 'bg-amber-400 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab Body Content */}
        <div className="flex-1 overflow-y-auto font-mono text-xs space-y-3 pr-1">
          {tab === 'overview' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div style={{ backgroundColor: '#12151e' }} className="p-3 rounded-xl border border-slate-700/40">
                  <span className="text-slate-400">Step Status:</span>
                  <div className="font-bold text-amber-300 text-sm mt-0.5 uppercase">{step.status}</div>
                </div>
                <div style={{ backgroundColor: '#12151e' }} className="p-3 rounded-xl border border-slate-700/40">
                  <span className="text-slate-400">Execution Mode:</span>
                  <div className="font-bold text-emerald-300 text-sm mt-0.5 uppercase">{step.executionMode}</div>
                </div>
                <div style={{ backgroundColor: '#12151e' }} className="p-3 rounded-xl border border-slate-700/40">
                  <span className="text-slate-400">Timeout Configuration:</span>
                  <div className="font-bold text-white text-sm mt-0.5">{step.timeoutMs / 1000}s</div>
                </div>
                <div style={{ backgroundColor: '#12151e' }} className="p-3 rounded-xl border border-slate-700/40">
                  <span className="text-slate-400">Max Retries:</span>
                  <div className="font-bold text-white text-sm mt-0.5">{step.maxRetries} Retries</div>
                </div>
              </div>
            </div>
          )}

          {tab === 'input' && (
            <div style={{ backgroundColor: '#090b10' }} className="p-4 rounded-xl text-emerald-300 whitespace-pre-wrap leading-relaxed">
              {JSON.stringify(step.inputSummary || { step: step.title, function: step.selectedFunction }, null, 2)}
            </div>
          )}

          {tab === 'logs' && (
            <div style={{ backgroundColor: '#090b10' }} className="p-4 rounded-xl text-slate-200 whitespace-pre-wrap space-y-1">
              {step.logs.length === 0 ? (
                <div className="text-slate-500 italic">[No log entries recorded for this step]</div>
              ) : (
                step.logs.map((l, idx) => (
                  <div key={idx}>[{l.timestamp}] {l.message}</div>
                ))
              )}
            </div>
          )}

          {tab === 'output' && (
            <div style={{ backgroundColor: '#090b10' }} className="p-4 rounded-xl text-amber-300 whitespace-pre-wrap leading-relaxed">
              {JSON.stringify(step.outputSummary || { result: 'Step execution completed successfully' }, null, 2)}
            </div>
          )}

          {tab === 'artifacts' && (
            <div className="space-y-2">
              {step.artifacts.length === 0 ? (
                <div className="text-slate-400 italic p-4 bg-[#12151e] rounded-xl text-center">Chưa có artifact nào được tạo từ bước này.</div>
              ) : (
                step.artifacts.map((art) => (
                  <div key={art.id} style={{ backgroundColor: '#12151e' }} className="p-3 rounded-xl border border-slate-700/40 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white">{art.name} ({art.type})</div>
                      <div className="text-[11px] text-slate-400">{art.path || art.url}</div>
                    </div>
                    <button
                      onClick={() => toast.success(`Opened artifact: ${art.name}`)}
                      className="px-2.5 py-1 bg-amber-400 text-slate-950 font-bold rounded-lg"
                    >
                      Open
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'cdp' && (
            <div className="space-y-3">
              <div style={{ backgroundColor: '#12151e' }} className="p-3 rounded-xl border border-slate-700/40">
                <span className="text-slate-400">CDP Controlled URL:</span>
                <div className="font-bold text-amber-300 text-xs mt-0.5">https://tiktok.com/studio/trends</div>
              </div>
              <div style={{ backgroundColor: '#12151e' }} className="p-3 rounded-xl border border-slate-700/40">
                <span className="text-slate-400">Playwright Trace:</span>
                <div className="font-bold text-blue-300 text-xs mt-0.5">artifacts/traces/playwright_step_{step.stepNumber}.zip</div>
              </div>
            </div>
          )}

          {tab === 'errors' && (
            <div className="space-y-3">
              {step.errorMessage ? (
                <div style={{ backgroundColor: 'rgba(244, 63, 94, 0.15)', border: '1px solid #f43f5e' }} className="p-4 rounded-xl text-rose-300">
                  <div className="font-bold text-sm">Error Code: {step.errorCode || 'STEP_RUN_ERROR'}</div>
                  <div className="mt-1 text-xs">{step.errorMessage}</div>
                  <button
                    onClick={() => {
                      onRetryStep(step.id);
                      onClose();
                    }}
                    className="mt-3 px-3 py-1.5 bg-rose-500 text-white font-bold rounded-lg flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Retry Step #{step.stepNumber}
                  </button>
                </div>
              ) : (
                <div className="text-emerald-400 italic p-4 bg-[#12151e] rounded-xl text-center">✓ Không có lỗi nào được ghi nhận cho bước này.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
