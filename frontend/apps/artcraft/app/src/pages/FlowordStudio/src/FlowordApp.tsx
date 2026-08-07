import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  DEFAULT_WORKFLOW_INPUT,
  INITIAL_STEP_CONFIGS,
  ACTIVE_JOB_ID_KEY,
  migrateLegacyLocalStorageKeys,
} from './services/workflowEngine';
import {
  DetailedReadinessStatus,
  DEFAULT_READINESS,
  fetchDetailedReadiness,
  enqueueFlowordWorkflow,
  getFlowordWorkflow,
  cancelFlowordWorkflow,
  retryFlowordStep,
  FlowordCommandError,
  GetFlowordWorkflowResponse,
} from './api/flowordClient';

const POLL_INTERVAL_MS = 2000;

/// Backend stages that are terminal — polling stops when one is observed.
const TERMINAL_STAGES = new Set([
  'completed',
  'draft_ready',
  'failed',
  'cancelled',
]);

/// Backend statuses that are terminal.
const TERMINAL_STATUSES = new Set([
  'complete_success',
  'complete_failure',
  'cancelled_by_user',
  'cancelled_by_provider',
  'cancelled_by_us',
  'dead',
]);

export const FlowordApp: React.FC = () => {
  const [viewMode, setViewMode] = useState<'execution_plan' | 'flow_design' | 'browser_cdp'>('execution_plan');

  const [workflowInput, setWorkflowInput] = useState<WorkflowInput>(DEFAULT_WORKFLOW_INPUT);
  const [stepConfigs, setStepConfigs] = useState<StepConfig[]>(INITIAL_STEP_CONFIGS);

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
    '🟢 [NEODONUT ENGINE] Rust Backend Task System initialized.',
    '💡 Enqueue commands dispatch directly to the Rust Worker Thread & SQLite database.',
  ]);
  const [activeDraftUrl, setActiveDraftUrl] = useState<string>('');
  const [detailModalStepId, setDetailModalStepId] = useState<string | null>(null);
  const [activeWorkflowRun, setActiveWorkflowRun] = useState<WorkflowRun | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const [readiness, setReadiness] = useState<DetailedReadinessStatus>(DEFAULT_READINESS);

  // Single polling timer + the job id it is bound to. Guards against duplicate
  // timers and stale polling of an old job after a new enqueue.
  const pollingTimerRef = useRef<number | null>(null);
  const pollingJobIdRef = useRef<string | null>(null);
  // A one-shot latch so WORKFLOW_NOT_FOUND surfaces a single toast, not one per tick.
  const notFoundNotifiedRef = useRef<boolean>(false);

  const appendLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-150), `[${timestamp}] ${msg}`]);
  }, []);

  // ---- Readiness polling (backend-driven, no hard-coded READY) --------------
  useEffect(() => {
    let cancelled = false;
    const updateReadiness = async () => {
      const res = await fetchDetailedReadiness();
      if (!cancelled) setReadiness(res);
    };
    updateReadiness();
    const interval = window.setInterval(updateReadiness, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  // ---- Polling lifecycle ----------------------------------------------------
  const stopWorkflowPolling = useCallback(() => {
    if (pollingTimerRef.current !== null) {
      window.clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    pollingJobIdRef.current = null;
  }, []);

  const applyStatusToUi = useCallback((res: GetFlowordWorkflowResponse) => {
    const stage = res.current_stage || '';
    const status = res.status || '';

    let stageIdx = 0;
    if (stage.includes('script')) stageIdx = 1;
    else if (stage.includes('draft_creating') || stage.includes('draft_created')) stageIdx = 3;
    else if (stage.includes('caption')) stageIdx = 4;
    else if (stage.includes('draft_saving') || stage.includes('draft_ready')) stageIdx = 5;
    else if (stage.includes('render') || stage.includes('completed')) stageIdx = 5;

    setActiveStepIndex(stageIdx);
    setCurrentStepMessage(`[Rust Backend] stage=${stage} status=${status}`);
    setStepRuns((prev) =>
      prev.map((s, idx) =>
        idx === stageIdx
          ? { ...s, status: status === 'complete_success' ? 'succeeded' : 'running' }
          : idx < stageIdx
          ? { ...s, status: 'succeeded', progress: 100 }
          : s
      )
    );
  }, []);

  const handleWorkflowNotFound = useCallback(
    (jobId: string) => {
      stopWorkflowPolling();
      // Drop the stale id so the app boots idle next time.
      localStorage.removeItem(ACTIVE_JOB_ID_KEY);
      setActiveJobId(null);
      setRunning(false);
      setActiveStepIndex(-1);
      setActiveWorkflowRun(null);
      if (!notFoundNotifiedRef.current) {
        notFoundNotifiedRef.current = true;
        appendLog(`⚠️ [WORKFLOW_NOT_FOUND] Job ${jobId} not found in backend. Cleared active job.`);
        toast.error('Không tìm thấy workflow job trong backend. Đã xóa job cũ.');
      }
    },
    [appendLog, stopWorkflowPolling]
  );

  const pollOnce = useCallback(
    async (jobId: string) => {
      // Guard: never poll an id that is no longer the active polling target.
      if (pollingJobIdRef.current !== jobId) return;

      let res: GetFlowordWorkflowResponse;
      try {
        res = await getFlowordWorkflow(jobId);
      } catch (err) {
        if (err instanceof FlowordCommandError && err.errorCode === 'WORKFLOW_NOT_FOUND') {
          handleWorkflowNotFound(jobId);
          return;
        }
        // Transient/unexpected error: log once per tick but keep polling.
        appendLog(`❌ [POLL_ERROR] ${err instanceof Error ? err.message : String(err)}`);
        return;
      }

      applyStatusToUi(res);

      const isTerminal = TERMINAL_STATUSES.has(res.status) || TERMINAL_STAGES.has(res.current_stage);
      if (isTerminal) {
        stopWorkflowPolling();
        setRunning(false);
        setActiveStepIndex(-1);
        setProgress(100);

        const isSuccess = res.status === 'complete_success';
        setActiveWorkflowRun((prev) =>
          prev
            ? {
                ...prev,
                status: isSuccess ? (res.current_stage === 'draft_ready' ? 'draft_ready' : 'completed') : 'failed',
                progress: 100,
                completedAt: new Date().toISOString(),
                errorMessage: res.failure_message ?? undefined,
              }
            : prev
        );

        if (isSuccess) {
          appendLog(`🎉 [WORKER COMPLETE] Job ${jobId} finished (stage=${res.current_stage}).`);
          toast.success('Pipeline hoàn tất ở backend!');
        } else if (res.status.startsWith('cancelled')) {
          appendLog(`🛑 [CANCELLED] Job ${jobId} cancelled.`);
        } else {
          appendLog(`❌ [WORKER FAILED] Job ${jobId}: ${res.failure_message ?? res.status}`);
          toast.error(`Job thất bại: ${res.failure_message ?? res.status}`);
        }
      }
    },
    [appendLog, applyStatusToUi, handleWorkflowNotFound, stopWorkflowPolling]
  );

  const startWorkflowPolling = useCallback(
    (jobId: string) => {
      if (!jobId) return;
      // Tear down any prior timer so we never run two, and never poll an old id.
      stopWorkflowPolling();
      notFoundNotifiedRef.current = false;
      pollingJobIdRef.current = jobId;
      // Fire immediately, then on interval.
      void pollOnce(jobId);
      pollingTimerRef.current = window.setInterval(() => {
        void pollOnce(jobId);
      }, POLL_INTERVAL_MS);
    },
    [pollOnce, stopWorkflowPolling]
  );

  // Stop polling on unmount.
  useEffect(() => {
    return () => stopWorkflowPolling();
  }, [stopWorkflowPolling]);

  // ---- Restore active job from LocalStorage on mount ------------------------
  useEffect(() => {
    migrateLegacyLocalStorageKeys();
    const jobId = localStorage.getItem(ACTIVE_JOB_ID_KEY);
    if (!jobId) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await getFlowordWorkflow(jobId);
        if (cancelled) return;
        setActiveJobId(jobId);
        applyStatusToUi(res);
        const isTerminal = TERMINAL_STATUSES.has(res.status) || TERMINAL_STAGES.has(res.current_stage);
        if (!isTerminal) {
          setRunning(true);
          startWorkflowPolling(jobId);
          appendLog(`♻️ [RESTORE] Resumed polling active job ${jobId}.`);
        } else {
          appendLog(`♻️ [RESTORE] Active job ${jobId} already terminal (${res.status}).`);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof FlowordCommandError && err.errorCode === 'WORKFLOW_NOT_FOUND') {
          localStorage.removeItem(ACTIVE_JOB_ID_KEY);
          setActiveJobId(null);
          appendLog(`♻️ [RESTORE] Stale job ${jobId} not found — cleared. Idle.`);
        } else {
          appendLog(`♻️ [RESTORE_ERROR] ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Config persistence (unchanged behavior) ------------------------------
  const handleSelectFunction = (stepId: string, fnName: string) => {
    setStepConfigs((prev) => prev.map((s) => (s.id === stepId ? { ...s, selectedFunction: fnName } : s)));
    setStepRuns((prev) => prev.map((s) => (s.id === stepId ? { ...s, selectedFunction: fnName } : s)));
    appendLog(`⚙️ [CONFIG] Assigned function "${fnName}" to ${stepId}`);
    toast.success(`Gán chức năng "${fnName}" thành công!`);
  };

  const handleSaveConfig = () => {
    localStorage.setItem('neodonut_project_input', JSON.stringify(workflowInput));
    localStorage.setItem('neodonut_step_configs', JSON.stringify(stepConfigs));
    appendLog('💾 [CONFIG] Saved workflow input and step configuration.');
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
            const match = parsed.find((p: StepConfig) => p.id === sr.id);
            return match ? { ...sr, ...match } : sr;
          })
        );
      }
      appendLog('📂 [CONFIG] Loaded saved workflow configuration.');
      toast.success('Đã tải cấu hình Workflow đã lưu!');
    } catch {
      toast.error('Could not load saved workflow configuration');
    }
  };

  // ---- Execute ---------------------------------------------------------------
  const handleExecuteWorkflow = async () => {
    if (running) return;

    if (!workflowInput.prompt.trim() && workflowInput.sourceUrls.length === 0) {
      toast.error('Vui lòng nhập Main Prompt hoặc ít nhất 1 Source URL!');
      return;
    }

    // Clear any prior run's polling before enqueuing a fresh job.
    stopWorkflowPolling();
    setProgress(5);
    setActiveStepIndex(0);
    setCurrentStepMessage('Enqueuing workflow into Rust Task Database...');
    appendLog(`🚀 [TAURI INVOKE] enqueue_floword_workflow...`);

    let jobId: string;
    try {
      const res = await enqueueFlowordWorkflow({
        workflow_name: workflowInput.workflowName,
        prompt: workflowInput.prompt,
        topic: workflowInput.topic,
        source_urls: workflowInput.sourceUrls,
        target_platform: workflowInput.targetPlatform,
        target_duration_seconds: workflowInput.targetDurationSeconds,
        output_mode: workflowInput.outputMode,
        model_id: workflowInput.modelId,
      });
      jobId = res.job_id;
    } catch (err) {
      // Enqueue failed: show the REAL error, do NOT invent an id, do NOT poll,
      // do NOT persist, do NOT claim success.
      const code = err instanceof FlowordCommandError ? err.errorCode : undefined;
      const msg = err instanceof Error ? err.message : String(err);
      setProgress(0);
      setActiveStepIndex(-1);
      setCurrentStepMessage('Enqueue failed.');
      appendLog(`❌ [ENQUEUE_FAILED] ${code ? `[${code}] ` : ''}${msg}`);
      toast.error(`Enqueue thất bại${code ? ` (${code})` : ''}: ${msg}`);
      return;
    }

    // Success: persist ONLY the real job id and start polling it.
    localStorage.setItem(ACTIVE_JOB_ID_KEY, jobId);
    setActiveJobId(jobId);
    setRunning(true);
    appendLog(`✓ [RUST BACKEND] Enqueued. job_id=${jobId}`);

    const initialRun: WorkflowRun = {
      id: jobId,
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

    startWorkflowPolling(jobId);
  };

  const handleCancelWorkflow = async () => {
    const jobId = activeJobId ?? activeWorkflowRun?.id;
    if (!jobId) {
      // Nothing running — just reset local UI.
      stopWorkflowPolling();
      setRunning(false);
      setActiveStepIndex(-1);
      return;
    }
    stopWorkflowPolling();
    setRunning(false);
    setActiveStepIndex(-1);
    try {
      await cancelFlowordWorkflow(jobId);
      appendLog(`🛑 [CANCELLED] Sent cancel_floword_workflow for ${jobId}.`);
      toast('Đã gửi lệnh hủy tới backend.', { icon: '🛑' });
    } catch (err) {
      if (err instanceof FlowordCommandError && err.errorCode === 'WORKFLOW_NOT_FOUND') {
        localStorage.removeItem(ACTIVE_JOB_ID_KEY);
        setActiveJobId(null);
        appendLog(`⚠️ [CANCEL] Job ${jobId} not found (already gone).`);
        return;
      }
      appendLog(`❌ [CANCEL_ERROR] ${err instanceof Error ? err.message : String(err)}`);
      toast.error('Lệnh hủy thất bại.');
    }
  };

  const handleRetryStep = async (stepId: string) => {
    const jobId = activeJobId ?? activeWorkflowRun?.id;
    if (!jobId) {
      toast.error('Không có job đang chạy để retry.');
      return;
    }
    try {
      const res = await retryFlowordStep(jobId, stepId);
      appendLog(`🔁 [RETRY] Step ${stepId} → resumed at ${res.resumed_stage} (retry #${res.step_retry_count}). Same job ${jobId}.`);
      toast.success(`Retry ${stepId}: tiếp tục cùng job.`);
      // Resume polling the SAME job — never enqueue a new workflow.
      setRunning(true);
      startWorkflowPolling(jobId);
    } catch (err) {
      if (err instanceof FlowordCommandError && err.errorCode === 'WORKFLOW_NOT_FOUND') {
        handleWorkflowNotFound(jobId);
        return;
      }
      appendLog(`❌ [RETRY_ERROR] ${err instanceof Error ? err.message : String(err)}`);
      toast.error('Retry thất bại.');
    }
  };

  const modalStep = stepRuns.find((s) => s.id === detailModalStepId);

  return (
    <div className="flex flex-col h-full w-full bg-[#0d1017] text-slate-100 select-none overflow-hidden font-sans">
      <Toaster position="top-right" toastOptions={{ style: { background: '#1a1f2c', color: '#ffc880' } }} />

      <FlowordHeader
        status={{
          mateOnline: readiness.capcut.status === 'READY',
          omniOnline: readiness.omniRoute.status === 'READY',
          rustPipelineOnline: readiness.storage.status === 'READY',
        }}
        activeDraftUrl={activeDraftUrl}
        running={running}
        onRunWorkflow={running ? handleCancelWorkflow : handleExecuteWorkflow}
        onSaveWorkflow={handleSaveConfig}
        onAddStep={() => setViewMode('flow_design')}
      />

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

      {detailModalStepId && modalStep && (
        <StepDetailModal step={modalStep} onClose={() => setDetailModalStepId(null)} onRetryStep={handleRetryStep} />
      )}
    </div>
  );
};
