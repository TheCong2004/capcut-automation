import React, { useState } from 'react';
import {
  WorkflowInput,
  WorkflowRun,
  StepRun,
  ArtifactRef,
  StepConfig,
} from '../services/workflowEngine';
import { DetailedReadinessStatus } from '../api/flowordClient';
import { ProjectBriefPanel } from './ProjectBriefPanel';
import { FlowordPipelineVisualizer, NeoStep } from './FlowordPipelineVisualizer';
import { StepSubInterfacePanel } from './StepSubInterfacePanel';
import { LiveExecutionLog } from './LiveExecutionLog';
import { DraftExplorer } from './DraftExplorer';
import { Play, Square, Save, RefreshCw, FolderOpen, Video, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface ExecutionPlanViewProps {
  input: WorkflowInput;
  onChangeInput: (newInput: WorkflowInput) => void;
  steps: StepConfig[];
  stepRuns: StepRun[];
  activeStepIndex: number;
  selectedStepId: string;
  running: boolean;
  progress: number;
  currentStepMessage: string;
  logs: string[];
  readiness: DetailedReadinessStatus;
  activeDraftUrl: string;
  activeWorkflowRun: WorkflowRun | null;
  onSelectStep: (stepId: string) => void;
  onSelectFunction: (stepId: string, fnName: string) => void;
  onSelectDraft: (draftUrl: string) => void;
  onExecuteWorkflow: () => void;
  onCancelWorkflow: () => void;
  onSaveConfig: () => void;
  onLoadConfig: () => void;
  onClearLogs: () => void;
  onOpenDetailModal: (stepId: string) => void;
}

export const ExecutionPlanView: React.FC<ExecutionPlanViewProps> = ({
  input,
  onChangeInput,
  steps,
  stepRuns,
  activeStepIndex,
  selectedStepId,
  running,
  progress,
  currentStepMessage,
  logs,
  readiness,
  activeDraftUrl,
  activeWorkflowRun,
  onSelectStep,
  onSelectFunction,
  onSelectDraft,
  onExecuteWorkflow,
  onCancelWorkflow,
  onSaveConfig,
  onLoadConfig,
  onClearLogs,
  onOpenDetailModal,
}) => {
  const [activeTab, setActiveTab] = useState<'subinterface' | 'drafts'>('subinterface');

  const selectedStepRun = stepRuns.find((s) => s.id === selectedStepId) || stepRuns[0];

  // Convert stepRuns to NeoStep format for visualizer
  const visualSteps: NeoStep[] = stepRuns.map((sr) => ({
    id: sr.id,
    stepNumber: sr.stepNumber,
    title: sr.title,
    subtitle: sr.subtitle,
    description: sr.description,
    imageUrl: sr.imageUrl,
    status: sr.status === 'running' ? 'running' : sr.status === 'succeeded' ? 'completed' : 'pending',
    actionKey: sr.actionKey,
    functions: sr.functions,
    selectedFunction: sr.selectedFunction,
  }));

  const isFormValid = input.prompt.trim().length > 0 || input.sourceUrls.length > 0;

  return (
    <div className="flex flex-col gap-4 select-none font-sans pb-6">
      {/* 1. Service Readiness Health Strip */}
      <section style={{ backgroundColor: '#141722', border: '1px solid rgba(255, 255, 255, 0.08)' }} className="p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white uppercase text-xs">Service Readiness:</span>
          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${readiness.isReadyForExecution ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
            {readiness.isReadyForExecution ? '✓ READY FOR EXECUTION' : '⚠ SYSTEM DEGRADED'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {Object.entries(readiness).map(([key, val]) => {
            if (typeof val !== 'object' || !val) return null;
            const isOk = val.status === 'READY';
            return (
              <div key={key} title={`${val.name}: ${val.message} (${val.endpoint})`} className="flex items-center gap-1.5 bg-[#1b1f2b] px-2.5 py-1 rounded-lg">
                <span className={`w-2 h-2 rounded-full ${isOk ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className="text-slate-300 font-semibold">{val.name}:</span>
                <span className={isOk ? 'text-emerald-300 font-bold' : 'text-amber-300'}>{val.status}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. Project Brief Input Panel */}
      <section>
        <ProjectBriefPanel
          input={input}
          onChangeInput={onChangeInput}
          onSaveConfig={onSaveConfig}
          onLoadConfig={onLoadConfig}
        />
      </section>

      {/* 3. Action Execution Control Bar */}
      <section style={{ backgroundColor: '#141722', border: '1px solid rgba(255, 255, 255, 0.08)' }} className="p-3.5 rounded-2xl flex items-center justify-between gap-4 font-mono text-xs">
        <div>
          <h3 className="font-bold text-sm text-white">Execution Control Center</h3>
          <p className="text-slate-300 text-[11px]">Kích hoạt quy trình 6 bước tự động hóa end-to-end</p>
        </div>

        <div className="flex items-center gap-3">
          {running ? (
            <button
              onClick={onCancelWorkflow}
              className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl flex items-center gap-2 transition-colors shadow-md"
            >
              <Square className="w-4 h-4 fill-white" /> Cancel Workflow Execution
            </button>
          ) : (
            <button
              onClick={onExecuteWorkflow}
              disabled={!isFormValid}
              style={{
                backgroundColor: isFormValid ? '#fbbf24' : '#334155',
                color: isFormValid ? '#0f172a' : '#94a3b8',
              }}
              className="px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shadow-lg disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4 fill-slate-950" /> Execute Workflow Plan
            </button>
          )}
        </div>
      </section>

      {/* 4. 6 Module Node Pipeline Visualizer Cards */}
      <section>
        <FlowordPipelineVisualizer
          steps={visualSteps}
          activeStepIndex={activeStepIndex}
          selectedStepId={selectedStepId}
          running={running}
          onSelectStep={(id) => {
            onSelectStep(id);
            onOpenDetailModal(id);
          }}
        />
      </section>

      {/* 5. Final Output Results Banner (If workflow completed) */}
      {activeWorkflowRun && (activeWorkflowRun.status === 'succeeded' || activeWorkflowRun.resultType) && (
        <section style={{ backgroundColor: '#18241e', border: '1.5px solid #34d399' }} className="p-4 rounded-2xl shadow-xl font-mono text-xs text-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-sm text-emerald-300">
                🎉 WORKFLOW EXECUTED SUCCESSFUL — Output Semantics: [{activeWorkflowRun.resultType === 'video' ? 'Completed (Video Rendered)' : 'DraftReady (CapCut Draft Created)'}]
              </h3>
            </div>
            <span className="bg-emerald-500/20 text-emerald-300 font-bold px-3 py-1 rounded-full">
              Status: {activeWorkflowRun.status.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
            <div className="bg-[#0f1712] p-3 rounded-xl">
              <span className="text-slate-400">Target Draft URL / ID:</span>
              <div className="font-bold text-amber-300 truncate mt-0.5">{activeWorkflowRun.finalDraftUrl || activeDraftUrl}</div>
            </div>
            <div className="bg-[#0f1712] p-3 rounded-xl">
              <span className="text-slate-400">Rendered Video File Path:</span>
              <div className="font-bold text-emerald-300 truncate mt-0.5">{activeWorkflowRun.finalVideoPath || 'Ready in CapCut Timeline Export'}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => toast.success(`Opened CapCut Draft: ${activeDraftUrl}`)}
              className="px-3.5 py-1.5 bg-emerald-400 text-slate-950 font-bold rounded-xl flex items-center gap-1.5"
            >
              <FolderOpen className="w-4 h-4" /> Open Draft in CapCut
            </button>

            <button
              onClick={() => {
                navigator.clipboard.writeText(activeDraftUrl);
                toast.success('Đã sao chép Draft ID!');
              }}
              className="px-3 py-1.5 bg-[#203228] text-emerald-300 font-bold rounded-xl hover:bg-[#2a4235]"
            >
              Copy Draft ID
            </button>
          </div>
        </section>
      )}

      {/* 6. Bottom Split: Left = Sub-Interface & Draft Explorer, Right = Output Terminal Logs */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[360px]">
        {/* Left (6 cols) */}
        <div className="lg:col-span-6 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 bg-[#161a26] p-1.5 rounded-xl shrink-0 font-mono text-xs">
            <button
              onClick={() => setActiveTab('subinterface')}
              className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                activeTab === 'subinterface' ? 'bg-amber-400 text-slate-950 shadow-md' : 'text-slate-300 hover:text-white'
              }`}
            >
              Sub-Interface: Step #{selectedStepRun.stepNumber} ({selectedStepRun.title})
            </button>
            <button
              onClick={() => setActiveTab('drafts')}
              className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                activeTab === 'drafts' ? 'bg-amber-400 text-slate-950 shadow-md' : 'text-slate-300 hover:text-white'
              }`}
            >
              CapCut Desktop Drafts
            </button>
          </div>

          <div className="flex-1">
            {activeTab === 'subinterface' ? (
              <StepSubInterfacePanel
                step={selectedStepRun}
                onSelectFunction={onSelectFunction}
                activeDraftUrl={activeDraftUrl}
              />
            ) : (
              <DraftExplorer
                activeDraftUrl={activeDraftUrl}
                onSelectDraft={onSelectDraft}
              />
            )}
          </div>
        </div>

        {/* Right (6 cols) */}
        <div className="lg:col-span-6">
          <LiveExecutionLog
            logs={logs}
            running={running}
            progress={progress}
            currentStepMessage={currentStepMessage}
            onClearLogs={onClearLogs}
          />
        </div>
      </section>
    </div>
  );
};
