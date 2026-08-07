import React from 'react';
import { GripVertical, Trash2, CheckSquare, Square, AlertOctagon, RefreshCw } from 'lucide-react';
import { WorkflowStep, WorkflowAction } from '../api/flowordClient';

interface WorkflowStepBuilderProps {
  steps: WorkflowStep[];
  onUpdateSteps: (steps: WorkflowStep[]) => void;
  onFailurePolicy: 'stop' | 'skip' | 'retry';
  onChangeFailurePolicy: (policy: 'stop' | 'skip' | 'retry') => void;
}

const ACTION_OPTIONS: { value: WorkflowAction; label: string; desc: string } = {
  info: { value: 'info', label: 'Import / Kiểm tra draft local', desc: 'Đọc thông tin local CapCut draft' },
  lint: { value: 'lint', label: 'Lint phụ đề & media', desc: 'Kiểm tra lỗi trùng lặp/overhang timeline' },
  sync_timelines: { value: 'sync_timelines', label: 'Sync timelines', desc: 'Đồng bộ lại track timeline trong CapCut' },
  save_draft: { value: 'save_draft', label: 'Lưu draft mate', desc: 'Lưu dự án lên server CapCut Mate' },
  enqueue_pipeline: { value: 'enqueue_pipeline', label: 'Tạo job Rust Pipeline', desc: 'Đẩy job vào hàng chờ Rust Dispatcher' },
  gen_video: { value: 'gen_video', label: 'Xuất video (gen_video)', desc: 'Kích hoạt render xuất video' },
  export_srt: { value: 'export_srt', label: 'Xuất file phụ đề SRT', desc: 'Xuất kịch bản ra định dạng SRT' },
  doctor: { value: 'doctor', label: 'CapCut Health Check', desc: 'Kiểm tra tính toàn vẹn hệ thống' },
};

export const WorkflowStepBuilder: React.FC<WorkflowStepBuilderProps> = ({
  steps,
  onUpdateSteps,
  onFailurePolicy,
  onChangeFailurePolicy,
}) => {
  const toggleStep = (id: string) => {
    onUpdateSteps(
      steps.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const changeAction = (id: string, action: WorkflowAction) => {
    onUpdateSteps(
      steps.map((s) => (s.id === id ? { ...s, action } : s))
    );
  };

  const updateLabel = (id: string, label: string) => {
    onUpdateSteps(
      steps.map((s) => (s.id === id ? { ...s, label } : s))
    );
  };

  const deleteStep = (id: string) => {
    onUpdateSteps(steps.filter((s) => s.id !== id));
  };

  return (
    <div className="flex flex-col h-full bg-[#111622] rounded-xl border border-slate-800 p-4">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
        <div>
          <h2 className="font-['Outfit'] font-semibold text-sm text-slate-100 uppercase tracking-wider">
            Cấu hình Quy trình (Workflow Steps)
          </h2>
          <p className="text-xs text-slate-400">Thiết lập các bước tự động hóa tuần tự</p>
        </div>
        <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          {steps.filter((s) => s.enabled).length} / {steps.length} Active
        </span>
      </div>

      {/* Steps List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`p-3 rounded-lg border transition-all ${
              step.enabled
                ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                : 'bg-slate-950/40 border-slate-900 opacity-60'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <GripVertical className="w-4 h-4 text-slate-600 cursor-grab hover:text-slate-400" />
              
              <button
                onClick={() => toggleStep(step.id)}
                className="text-slate-400 hover:text-indigo-400 transition-colors"
              >
                {step.enabled ? (
                  <CheckSquare className="w-4 h-4 text-indigo-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-600" />
                )}
              </button>

              <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-xs font-mono font-bold flex items-center justify-center">
                {index + 1}
              </span>

              <input
                type="text"
                value={step.label}
                onChange={(e) => updateLabel(step.id, e.target.value)}
                className="flex-1 bg-slate-950/60 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
              />

              <button
                onClick={() => deleteStep(step.id)}
                className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                title="Xóa bước"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Action Select */}
            <div className="pl-11 flex items-center gap-2">
              <label className="text-[11px] text-slate-400 font-medium">Hành động:</label>
              <select
                value={step.action}
                onChange={(e) => changeAction(step.id, e.target.value as WorkflowAction)}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-indigo-300 font-mono focus:outline-none focus:border-indigo-500"
              >
                {Object.entries(ACTION_OPTIONS).map(([key, opt]) => (
                  <option key={key} value={key}>
                    {opt.value} — {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      {/* Failure Policy Footer */}
      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-slate-400">
          <AlertOctagon className="w-4 h-4 text-amber-400" />
          <span>Khi gặp lỗi (On step failure):</span>
        </div>
        <select
          value={onFailurePolicy}
          onChange={(e) => onChangeFailurePolicy(e.target.value as any)}
          className="bg-slate-950 border border-slate-800 rounded px-3 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
        >
          <option value="stop">Dừng quy trình (Stop workflow)</option>
          <option value="skip">Bỏ qua bước lỗi (Skip step)</option>
          <option value="retry">Thử lại (Retry 3x)</option>
        </select>
      </div>
    </div>
  );
};
