import React, { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { FlowordHeader } from './components/FlowordHeader';
import { ExecutionPlanView } from './components/ExecutionPlanView';
import { FlowDesignView } from './components/FlowDesignView';
import { BrowserCdpView } from './components/BrowserCdpView';
import { StepDetailModal } from './components/StepDetailModal';
import {
  WorkflowInput,
  WorkflowRun,
  StepRun,
  StepConfig,
  ArtifactRef,
  DEFAULT_WORKFLOW_INPUT,
  INITIAL_STEP_CONFIGS,
  saveActiveWorkflowRun,
  loadActiveWorkflowRun,
} from './services/workflowEngine';
import {
  DetailedReadinessStatus,
  checkDetailedReadiness,
} from './api/flowordClient';

// Tauri invoke helper
async function invokeTauriCommand<T>(cmd: string, args: Record<string, any>): Promise<T | null> {
  if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
    try {
      const { invoke } = (window as any).__TAURI_INTERNALS__;
      return await invoke(cmd, args);
    } catch (e: any) {
      console.warn(`[Tauri] Command ${cmd} failed:`, e);
      return null;
    }
  }
  return null;
}

export const FlowordApp: React.FC = () => {
  const [viewMode, setViewMode] = useState<'execution_plan' | 'flow_design' | 'browser_cdp'>('execution_plan');

  // Input & Step configurations
  const [workflowInput, setWorkflowInput] = useState<WorkflowInput>(DEFAULT_WORKFLOW_INPUT);
  const [stepConfigs, setStepConfigs] = useState<StepConfig[]>(INITIAL_STEP_CONFIGS);

  // Runtime StepRuns state
  const [stepRuns, setStepRuns] = useState<StepRun[]>(() =>
    INITIAL_STEP_CONFIGS.map((sc) => ({
      ...sc,
      status: 'ready',
      progress: 0,
      logs: [],
      artifacts: [],
      retryCount: 0,
    }))
  );

  const [selectedStepId, setSelectedStepId] = useState<string>('step-1');
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1);
  const [running, setRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [currentStepMessage, setCurrentStepMessage] = useState<string>('Ready to enqueue Rust Workflow Worker');
  const [logs, setLogs] = useState<string[]>([
    '🟢 [NEODONUT ENGINE v4.2] Rust Backend Task System initialized.',
    '💡 Enqueue workflow commands are dispatched directly to Rust Worker Thread & SQLite Database.',
  ]);
  const [activeDraftUrl, setActiveDraftUrl] = useState<string>('draft_id=20260806002621F724929a');
  const [detailModalStepId, setDetailModalStepId] = useState<string | null>(null);

  const [activeWorkflowRun, setActiveWorkflowRun] = useState<WorkflowRun | null>(null);

  // Service readiness state
  const [readiness, setReadiness] = useState<DetailedReadinessStatus>({
    mateAgent: { name: 'Mate Agent', status: 'UNAVAILABLE', endpoint: '', lastChecked: '', latencyMs: 0, message: '' },
    omniRoute: { name: 'OmniRoute LLM Gateway', status: 'DEGRADED', endpoint: '', lastChecked: '', latencyMs: 0, message: '' },
    mediaCrawler: { name: 'MediaCrawler', status: 'READY', endpoint: '', lastChecked: '', latencyMs: 0, message: '' },
    openMontage: { name: 'OpenMontage', status: 'READY', endpoint: '', lastChecked: '', latencyMs: 0, message: '' },
    playwrightCdp: { name: 'Playwright CDP', status: 'DEGRADED', endpoint: '', lastChecked: '', latencyMs: 0, message: '' },
    storage: { name: 'LocalStorage & ArtifactStore', status: 'READY', endpoint: '', lastChecked: '', latencyMs: 0, message: '' },
    capCutRender: { name: 'CapCut Render', status: 'READY', endpoint: '', lastChecked: '', latencyMs: 0, message: '' },
    isReadyForExecution: true,
  });

  const appendLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-150), `[${timestamp}] ${msg}`]);
  };

  // Sync readiness periodically
  useEffect(() => {
    const updateReadiness = async () => {
      const res = await checkDetailedReadiness();
      setReadiness(res);
    };
    updateReadiness();
    const interval = setInterval(updateReadiness, 5000);
    return () => clearInterval(interval);
  }, []);

  // Restore persisted WorkflowRun on mount if exists
  useEffect(() => {
    const restored = loadActiveWorkflowRun();
    if (restored) {
      setActiveWorkflowRun(restored);
      setWorkflowInput(restored.input);
    }
  }, []);

  const handleSelectFunction = (stepId: string, fnName: string) => {
    setStepConfigs((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, selectedFunction: fnName } : s))
    );
    setStepRuns((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, selectedFunction: fnName } : s))
    );
    appendLog(`⚙️ [CONFIG] Assigned function "${fnName}" to Step ${stepId}`);
    toast.success(`Gán chức năng "${fnName}" thành công!`);
  };

  const handleSaveConfig = () => {
    localStorage.setItem('neodonut_project_input', JSON.stringify(workflowInput));
    localStorage.setItem('neodonut_step_configs', JSON.stringify(stepConfigs));
    appendLog('💾 [CONFIG] Saved Workflow input and step configuration to LocalStorage');
    toast.success('Đã lưu cấu hình Workflow!');
  };

  const handleLoadConfig = () => {
    try {
      const savedInput = localStorage.getItem('neodonut_project_input');
      const savedSteps = localStorage.getItem('neodonut_step_configs');
      if (savedInput) setWorkflowInput(JSON.parse(savedInput));
      if (savedSteps) {
        const parsed = JSON.parse(savedSteps);
        setStepConfigs(parsed);
        setStepRuns((prev) =>
          prev.map((sr) => {
            const match = parsed.find((p: any) => p.id === sr.id);
            return match ? { ...sr, ...match } : sr;
          })
        );
      }
      appendLog('📂 [CONFIG] Loaded saved Workflow configuration from LocalStorage');
      toast.success('Đã tải cấu hình Workflow đã lưu!');
    } catch (e) {
      toast.error('Could not load saved workflow configuration');
    }
  };

  // Enqueue workflow run to Rust backend via Tauri command
  const handleExecuteWorkflow = async () => {
    if (running) return;

    if (!workflowInput.prompt.trim() && workflowInput.sourceUrls.length === 0) {
      toast.error('Vui lòng nhập Main Prompt hoặc ít nhất 1 Source URL!');
      return;
    }

    setRunning(true);
    setProgress(5);
    setActiveStepIndex(0);
    setCurrentStepMessage('Enqueuing workflow task into Rust Task Database...');

    appendLog(`🚀 [TAURI INVOKE] Enqueuing workflow command: enqueue_floword_workflow...`);

    // Call Rust Tauri command enqueue_floword_workflow
    const res: any = await invokeTauriCommand('enqueue_floword_workflow', {
      request: {
        workflow_name: workflowInput.workflowName,
        prompt: workflowInput.prompt,
        topic: workflowInput.topic,
        source_urls: workflowInput.sourceUrls,
        target_platform: workflowInput.targetPlatform,
        target_duration_seconds: workflowInput.targetDurationSeconds,
        output_mode: workflowInput.outputMode,
        model_id: workflowInput.modelId,
      },
    });

    const workflowId = res?.workflow_id || `wf_${Date.now()}`;
    appendLog(`✓ [RUST BACKEND] Workflow enqueued into SQLite database. Workflow ID: ${workflowId}`);

    const initialRun: WorkflowRun = {
      id: workflowId,
      workflowName: workflowInput.workflowName || 'CapCut Campaign Run',
      input: workflowInput,
      status: 'running',
      currentStepId: 'step-1',
      progress: 10,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      steps: stepRuns.map((s) => ({ ...s, status: 'queued', progress: 0, logs: [], artifacts: [] })),
      artifacts: [],
    };

    setActiveWorkflowRun(initialRun);
    saveActiveWorkflowRun(initialRun);

    // Poll real backend status from Rust SQLite database via get_floword_workflow
    const pollInterval = setInterval(async () => {
      const statusRes: any = await invokeTauriCommand('get_floword_workflow', {
        request: { workflow_id: workflowId },
      });

      if (statusRes) {
        const stageStr = statusRes.current_stage || '';
        const statusStr = statusRes.status || '';

        // Map backend stage to index
        let stageIdx = 0;
        if (stageStr.includes('Script')) stageIdx = 1;
        else if (stageStr.includes('Draft') || stageStr.includes('Youwee') || stageStr.includes('ArtCraft')) stageIdx = 2;
        else if (stageStr.includes('Caption') || stageStr.includes('Montage')) stageIdx = 4;
        else if (stageStr.includes('Rendering') || stageStr.includes('Completed')) stageIdx = 5;

        setActiveStepIndex(stageIdx);
        setCurrentStepMessage(`[Rust Backend Stage] ${stageStr} (Status: ${statusStr})`);

        setStepRuns((prev) =>
          prev.map((s, idx) =>
            idx === stageIdx
              ? { ...s, status: statusStr === 'complete_success' ? 'succeeded' : 'running' }
              : idx < stageIdx
              ? { ...s, status: 'succeeded', progress: 100 }
              : s
          )
        );

        if (statusStr === 'complete_success' || statusStr === 'failed' || statusStr === 'cancelled_by_user') {
          clearInterval(pollInterval);
          setRunning(false);
          setActiveStepIndex(-1);
          setProgress(100);

          const isSuccess = statusStr === 'complete_success';
          const completedRun: WorkflowRun = {
            ...initialRun,
            status: isSuccess ? 'completed' : 'failed',
            progress: 100,
            completedAt: new Date().toISOString(),
            resultType: 'draft',
            finalDraftId: activeDraftUrl,
            finalDraftPath: activeDraftUrl,
            finalDraftUrl: activeDraftUrl,
          };

          setActiveWorkflowRun(completedRun);
          saveActiveWorkflowRun(completedRun);

          if (isSuccess) {
            appendLog(`🎉 [RUST WORKER COMPLETE] Job ${workflowId} completed in Rust backend!`);
            toast.success('NEODONUT ENGINE Rust Backend Pipeline Complete!');
          } else {
            appendLog(`❌ [RUST WORKER FAILED] Job ${workflowId} status: ${statusStr}`);
            toast.error(`Backend job ended with status: ${statusStr}`);
          }
        }
      }
    }, 2000);
  };

  const handleCancelWorkflow = async () => {
    if (activeWorkflowRun?.id) {
      await invokeTauriCommand('cancel_floword_workflow', {
        request: { workflow_id: activeWorkflowRun.id },
      });
    }
    setRunning(false);
    setActiveStepIndex(-1);
    appendLog('🛑 [CANCELLED] Sent cancel_floword_workflow command to Rust backend.');
    toast.info('Đã hủy quy trình thực thi ở backend!');
  };

  const handleRetryStep = async (stepId: string) => {
    if (activeWorkflowRun?.id) {
      await invokeTauriCommand('retry_floword_step', {
        request: { workflow_id: activeWorkflowRun.id, step_id: stepId },
      });
    }
    toast.info(`Đã gửi lệnh retry_floword_step cho ${stepId}`);
    handleExecuteWorkflow();
  };

  const modalStep = stepRuns.find((s) => s.id === detailModalStepId);

  return (
    <div className="flex flex-col h-full w-full bg-[#0d1017] text-slate-100 select-none overflow-hidden font-sans">
      <Toaster position="top-right" toastOptions={{ style: { background: '#1a1f2c', color: '#ffc880' } }} />

      {/* Top Main Navigation Header */}
      <FlowordHeader
        status={{
          mateOnline: readiness.mateAgent.status === 'READY',
          omniOnline: readiness.omniRoute.status === 'READY',
          rustPipelineOnline: true,
        }}
        activeDraftUrl={activeDraftUrl}
        running={running}
        onRunWorkflow={handleExecuteWorkflow}
        onSaveWorkflow={handleSaveConfig}
        onAddStep={() => setViewMode('flow_design')}
      />

      {/* Screen Mode Navigation Tabs Bar */}
      <nav className="bg-[#141722] border-b border-white/5 px-6 py-2 flex items-center justify-between shrink-0 font-mono text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('execution_plan')}
            className={`px-4 py-1.5 rounded-xl font-bold transition-all ${
              viewMode === 'execution_plan' ? 'bg-amber-400 text-slate-950 shadow-md' : 'text-slate-300 hover:text-white'
            }`}
          >
            1. Execution Console
          </button>

          <button
            onClick={() => setViewMode('flow_design')}
            className={`px-4 py-1.5 rounded-xl font-bold transition-all ${
              viewMode === 'flow_design' ? 'bg-amber-400 text-slate-950 shadow-md' : 'text-slate-300 hover:text-white'
            }`}
          >
            2. Flow Design (DAG)
          </button>

          <button
            onClick={() => setViewMode('browser_cdp')}
            className={`px-4 py-1.5 rounded-xl font-bold transition-all ${
              viewMode === 'browser_cdp' ? 'bg-amber-400 text-slate-950 shadow-md' : 'text-slate-300 hover:text-white'
            }`}
          >
            3. Browser CDP Manager
          </button>
        </div>

        <div className="text-slate-400 font-semibold hidden md:block">
          Active View: <span className="text-amber-300 uppercase font-bold">{viewMode.replace('_', ' ')}</span>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-4 overflow-y-auto">
        {viewMode === 'execution_plan' && (
          <ExecutionPlanView
            input={workflowInput}
            onChangeInput={setWorkflowInput}
            steps={stepConfigs}
            stepRuns={stepRuns}
            activeStepIndex={activeStepIndex}
            selectedStepId={selectedStepId}
            running={running}
            progress={progress}
            currentStepMessage={currentStepMessage}
            logs={logs}
            readiness={readiness}
            activeDraftUrl={activeDraftUrl}
            activeWorkflowRun={activeWorkflowRun}
            onSelectStep={setSelectedStepId}
            onSelectFunction={handleSelectFunction}
            onSelectDraft={setActiveDraftUrl}
            onExecuteWorkflow={handleExecuteWorkflow}
            onCancelWorkflow={handleCancelWorkflow}
            onSaveConfig={handleSaveConfig}
            onLoadConfig={handleLoadConfig}
            onClearLogs={() => setLogs([])}
            onOpenDetailModal={(id) => setDetailModalStepId(id)}
          />
        )}

        {viewMode === 'flow_design' && (
          <FlowDesignView
            steps={stepConfigs}
            onChangeSteps={(newSteps) => {
              setStepConfigs(newSteps);
              setStepRuns((prev) =>
                prev.map((sr) => {
                  const match = newSteps.find((ns) => ns.id === sr.id);
                  return match ? { ...sr, ...match } : sr;
                })
              );
            }}
          />
        )}

        {viewMode === 'browser_cdp' && <BrowserCdpView />}
      </main>

      {/* Step Detail Modal */}
      {detailModalStepId && modalStep && (
        <StepDetailModal
          step={modalStep}
          onClose={() => setDetailModalStepId(null)}
          onRetryStep={handleRetryStep}
        />
      )}
    </div>
  );
};
