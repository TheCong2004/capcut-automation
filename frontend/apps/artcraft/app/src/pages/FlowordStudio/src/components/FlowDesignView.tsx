import React from 'react';
import { StepConfig, ExecutionMode } from '../services/workflowEngine';
import { GitFork, ArrowRight, ToggleLeft, ToggleRight, Settings2, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

interface FlowDesignViewProps {
  steps: StepConfig[];
  onChangeSteps: (newSteps: StepConfig[]) => void;
}

export const FlowDesignView: React.FC<FlowDesignViewProps> = ({
  steps,
  onChangeSteps,
}) => {
  const handleToggleStep = (stepId: string) => {
    const updated = steps.map((s) => (s.id === stepId ? { ...s, enabled: !s.enabled } : s));
    onChangeSteps(updated);
    toast.success('Đã cập nhật trạng thái Bật/Tắt bước!');
  };

  const handleChangeMode = (stepId: string, mode: ExecutionMode) => {
    const updated = steps.map((s) => (s.id === stepId ? { ...s, executionMode: mode } : s));
    onChangeSteps(updated);
    toast.success(`Đã đổi Chế độ thực thi thành ${mode.toUpperCase()}`);
  };

  const handleChangeTimeout = (stepId: string, timeoutMs: number) => {
    const updated = steps.map((s) => (s.id === stepId ? { ...s, timeoutMs } : s));
    onChangeSteps(updated);
  };

  return (
    <div
      style={{ backgroundColor: '#1a1e28', border: '1px solid rgba(255, 255, 255, 0.08)' }}
      className="rounded-2xl p-5 shadow-md select-none text-slate-100 font-sans h-full overflow-y-auto space-y-5"
    >
      {/* Header */}
      <div style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} className="flex items-center justify-between pb-3 border-b">
        <div className="flex items-center gap-2">
          <GitFork className="w-5 h-5 text-amber-400" />
          <div>
            <h2 className="font-bold text-base text-white">Flow Design — Thiết kế Luồng DAG Pipeline</h2>
            <p className="text-xs text-slate-300">Cấu hình thứ tự, Bật/Tắt bước, Chế độ thực thi (API/CLI/CDP) & Timeout</p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-emerald-300 bg-emerald-500/20 px-3 py-1 rounded-full font-bold">
          Linear DAG Workflow Ready
        </div>
      </div>

      {/* Visual Pipeline Mapping Ribbon */}
      <div style={{ backgroundColor: '#12151e' }} className="p-4 rounded-xl flex items-center justify-between overflow-x-auto gap-3 border border-slate-700/40">
        {steps.map((step, idx) => (
          <React.Fragment key={step.id}>
            <div
              style={{
                backgroundColor: step.enabled ? '#222736' : '#181b24',
                opacity: step.enabled ? 1 : 0.4,
                border: step.enabled ? '1px solid rgba(251, 191, 36, 0.5)' : '1px solid rgba(255, 255, 255, 0.05)',
              }}
              className="px-3 py-2 rounded-xl flex items-center gap-2 shrink-0 font-mono text-xs"
            >
              <span className="w-5 h-5 rounded-md bg-amber-400 text-slate-950 font-bold flex items-center justify-center text-[10px]">
                #{step.stepNumber}
              </span>
              <span className="font-bold text-white">[{step.title}]</span>
              <span className="text-[10px] text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded font-bold uppercase">
                {step.executionMode}
              </span>
            </div>

            {idx < steps.length - 1 && (
              <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Detailed Step Configuration Table */}
      <div className="space-y-3 font-mono text-xs">
        <h3 className="font-bold text-sm text-amber-300 flex items-center gap-1.5">
          <Settings2 className="w-4 h-4" /> Cấu hình Chi tiết từng Module Node
        </h3>

        <div className="grid grid-cols-1 gap-3">
          {steps.map((step) => (
            <div
              key={step.id}
              style={{
                backgroundColor: step.enabled ? '#202432' : '#151822',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                opacity: step.enabled ? 1 : 0.6,
              }}
              className="p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              {/* Module Title & Description */}
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <button
                  onClick={() => handleToggleStep(step.id)}
                  className="text-amber-400 hover:text-amber-300 transition-colors mt-0.5"
                  title={step.enabled ? 'Tắt bước này' : 'Bật bước này'}
                >
                  {step.enabled ? <ToggleRight className="w-6 h-6 text-amber-400" /> : <ToggleLeft className="w-6 h-6 text-slate-600" />}
                </button>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">
                      #{step.stepNumber}. [{step.title}] — {step.subtitle}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${step.enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                      {step.enabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-sans mt-0.5">{step.description}</p>
                </div>
              </div>

              {/* Execution Mode & Timeout Config */}
              <div className="flex items-center gap-3 shrink-0">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Execution Mode:</label>
                  <select
                    value={step.executionMode}
                    onChange={(e) => handleChangeMode(step.id, e.target.value as ExecutionMode)}
                    style={{ backgroundColor: '#12151e', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                    className="px-2.5 py-1 rounded-lg text-white font-bold text-xs focus:outline-none focus:border-amber-400"
                  >
                    <option value="api">API (Direct HTTP/Service)</option>
                    <option value="cli">CLI (Command Line / Mate)</option>
                    <option value="cdp">CDP (Playwright Browser)</option>
                    <option value="manual">Manual Intervention</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Timeout (Sec):</label>
                  <input
                    type="number"
                    value={step.timeoutMs / 1000}
                    onChange={(e) => handleChangeTimeout(step.id, Number(e.target.value) * 1000)}
                    style={{ backgroundColor: '#12151e', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                    className="w-20 px-2 py-1 rounded-lg text-white font-bold text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
