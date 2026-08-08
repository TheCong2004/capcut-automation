import React, { useState } from 'react';
import { CheckCircle2, FolderOpen, Play, Square } from 'lucide-react';
import toast from 'react-hot-toast';

import { DetailedReadinessStatus } from '../api/flowordClient';
import { StepConfig, StepRun, WorkflowInput, WorkflowRun } from '../services/workflowEngine';
import { DraftExplorer } from './DraftExplorer';
import { NeoStep } from './FlowordPipelineVisualizer';
import { LiveExecutionLog } from './LiveExecutionLog';
import { ProjectBriefPanel } from './ProjectBriefPanel';
import { StepSubInterfacePanel } from './StepSubInterfacePanel';

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
  const selectedStepRun = stepRuns.find((step) => step.id === selectedStepId) || stepRuns[0];
  const selectedStep: NeoStep = {
    ...selectedStepRun,
    status: selectedStepRun.status === 'running'
      ? 'running'
      : selectedStepRun.status === 'succeeded'
      ? 'completed'
      : selectedStepRun.status === 'failed'
      ? 'failed'
      : selectedStepRun.status === 'skipped'
      ? 'skipped'
      : 'pending',
  };
  const isFormValid = input.prompt.trim().length > 0 || input.sourceUrls.length > 0;

  return (
    <div className="flex flex-col gap-5 pb-6">
      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(300px,0.8fr)]">
        <ProjectBriefPanel input={input} onChangeInput={onChangeInput} onSaveConfig={onSaveConfig} onLoadConfig={onLoadConfig} />

        <aside className="floword-card overflow-hidden xl:sticky xl:top-0">
          <div className="border-b border-white/[0.08] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">Pipeline Progress</h2>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">{currentStepMessage}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${readiness.isReadyForExecution ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
                {readiness.isReadyForExecution ? 'ready' : 'degraded'}
              </span>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-[#6366f1]" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 text-right text-xs font-medium text-zinc-500">{progress}%</div>
          </div>

          <div className="divide-y divide-white/[0.06]">
            {stepRuns.map((step, index) => {
              const active = index === activeStepIndex;
              const complete = step.status === 'succeeded';
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    onSelectStep(step.id);
                    onOpenDetailModal(step.id);
                  }}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-white/[0.03]"
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${complete ? 'bg-green-500/10 text-green-400' : active ? 'bg-blue-500/10 text-blue-400' : 'bg-white/[0.05] text-zinc-500'}`}>
                    {complete ? '✓' : step.stepNumber}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-200">{step.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-600">{step.status}</span>
                  </span>
                  {active && <span className="h-2 w-2 rounded-full bg-blue-500" />}
                </button>
              );
            })}
          </div>

          <div className="border-t border-white/[0.08] p-4">
            {running ? (
              <button type="button" onClick={onCancelWorkflow} className="floword-button w-full bg-red-500 text-white hover:bg-red-600">
                <Square className="h-4 w-4 fill-white" /> Cancel Run
              </button>
            ) : (
              <button type="button" onClick={onExecuteWorkflow} disabled={!isFormValid} className="floword-button floword-button-primary w-full disabled:cursor-not-allowed disabled:opacity-40">
                <Play className="h-4 w-4 fill-white" /> Run Workflow
              </button>
            )}
          </div>
        </aside>
      </section>

      {activeWorkflowRun && (activeWorkflowRun.status === 'completed' || activeWorkflowRun.status === 'draft_ready' || activeWorkflowRun.resultType) && (
        <section className="floword-card border-green-500/20 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-400" /><h3 className="text-sm font-semibold text-white">Workflow output is ready</h3></div>
            <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-semibold text-green-400">{activeWorkflowRun.status}</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-[9px] bg-white/[0.03] p-3"><div className="text-xs text-zinc-500">Draft</div><div className="mt-1 truncate font-mono text-xs text-zinc-300">{activeWorkflowRun.finalDraftUrl || activeDraftUrl || 'Not reported'}</div></div>
            <div className="rounded-[9px] bg-white/[0.03] p-3"><div className="text-xs text-zinc-500">Video</div><div className="mt-1 truncate font-mono text-xs text-zinc-300">{activeWorkflowRun.finalVideoPath || 'Not rendered'}</div></div>
          </div>
          {activeDraftUrl && <button type="button" onClick={() => toast.success(`Opened CapCut Draft: ${activeDraftUrl}`)} className="floword-button floword-button-secondary mt-4 text-zinc-200"><FolderOpen className="h-4 w-4" /> Open Draft</button>}
        </section>
      )}

      <section className="grid min-h-[420px] gap-5 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="inline-flex self-start rounded-[9px] border border-white/[0.08] bg-[#161b22] p-1 text-xs">
            <button type="button" onClick={() => setActiveTab('subinterface')} className={`rounded-[7px] px-3 py-2 font-medium ${activeTab === 'subinterface' ? 'bg-white/[0.08] text-white' : 'text-zinc-500'}`}>Selected step</button>
            <button type="button" onClick={() => setActiveTab('drafts')} className={`rounded-[7px] px-3 py-2 font-medium ${activeTab === 'drafts' ? 'bg-white/[0.08] text-white' : 'text-zinc-500'}`}>Drafts</button>
          </div>
          <div className="min-h-0 flex-1">
            {activeTab === 'subinterface' ? <StepSubInterfacePanel step={selectedStep} onSelectFunction={onSelectFunction} activeDraftUrl={activeDraftUrl} /> : <DraftExplorer activeDraftUrl={activeDraftUrl} onSelectDraft={onSelectDraft} />}
          </div>
        </div>
        <LiveExecutionLog logs={logs} running={running} progress={progress} currentStepMessage={currentStepMessage} onClearLogs={onClearLogs} />
      </section>
    </div>
  );
};
