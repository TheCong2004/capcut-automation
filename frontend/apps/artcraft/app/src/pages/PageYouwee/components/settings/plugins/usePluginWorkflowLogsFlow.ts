import { invoke } from '@tauri-apps/api/core';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { localizeUnknownError } from '@/lib/backend-error';
import type {
  LogEntry,
  PluginLogsPage,
  PluginSummary,
  PluginTriggerWorkflow,
  PluginWorkflowFailurePolicy,
} from '@/lib/types';
import { WORKFLOW_TRIGGERS, type WorkflowTrigger } from './post-download-plugins-shared';

type WorkflowState = {
  plugins: PluginSummary[];
  workflows: Record<string, PluginTriggerWorkflow>;
  setWorkflows: Dispatch<SetStateAction<Record<string, PluginTriggerWorkflow>>>;
  workflowCandidates: Record<string, string>;
  setWorkflowCandidates: Dispatch<SetStateAction<Record<string, string>>>;
};

export function usePluginWorkflowLogsFlow(
  t: TFunction<'settings'>,
  setError: Dispatch<SetStateAction<string | null>>,
  state: WorkflowState,
) {
  const { plugins, setWorkflowCandidates, setWorkflows, workflowCandidates, workflows } = state;
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsLoadingMore, setLogsLoadingMore] = useState(false);
  const [logsClearing, setLogsClearing] = useState(false);
  const [pluginLogs, setPluginLogs] = useState<LogEntry[]>([]);
  const [pluginLogsTotal, setPluginLogsTotal] = useState(0);
  const [pluginLogsHasMore, setPluginLogsHasMore] = useState(false);
  const [pluginLogsOffset, setPluginLogsOffset] = useState(0);
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);
  const [pluginLogsError, setPluginLogsError] = useState<string | null>(null);
  const [clearLogsConfirmOpen, setClearLogsConfirmOpen] = useState(false);

  const persistWorkflow = useCallback(
    async (nextWorkflow: PluginTriggerWorkflow) => {
      try {
        const saved = await invoke<PluginTriggerWorkflow>('update_plugin_trigger_workflow', {
          workflow: nextWorkflow,
        });
        setWorkflows((current) => ({
          ...current,
          [saved.trigger]: saved,
        }));
      } catch (err) {
        console.error('Failed to update plugin workflow:', err);
        setError(localizeUnknownError(err));
      }
    },
    [setError, setWorkflows],
  );

  const handleAddWorkflowPlugin = useCallback(
    async (trigger: WorkflowTrigger) => {
      const workflow = workflows[trigger] ?? { trigger, steps: [] };
      const pluginId = workflowCandidates[trigger] ?? '';
      if (!pluginId) return;
      await persistWorkflow({
        trigger,
        steps: [...workflow.steps, { pluginId, failurePolicy: 'continue' }],
      });
      setWorkflowCandidates((current) => ({ ...current, [trigger]: '' }));
    },
    [persistWorkflow, setWorkflowCandidates, workflowCandidates, workflows],
  );

  const handleRemoveWorkflowStep = useCallback(
    async (trigger: WorkflowTrigger, pluginId: string) => {
      const workflow = workflows[trigger] ?? { trigger, steps: [] };
      await persistWorkflow({
        trigger: workflow.trigger,
        steps: workflow.steps.filter((step) => step.pluginId !== pluginId),
      });
    },
    [persistWorkflow, workflows],
  );

  const handleMoveWorkflowStep = useCallback(
    async (trigger: WorkflowTrigger, pluginId: string, direction: -1 | 1) => {
      const workflow = workflows[trigger] ?? { trigger, steps: [] };
      const index = workflow.steps.findIndex((step) => step.pluginId === pluginId);
      if (index < 0) return;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= workflow.steps.length) return;
      const steps = [...workflow.steps];
      const [current] = steps.splice(index, 1);
      if (!current) return;
      steps.splice(nextIndex, 0, current);
      await persistWorkflow({
        trigger: workflow.trigger,
        steps,
      });
    },
    [persistWorkflow, workflows],
  );

  const handleWorkflowFailurePolicy = useCallback(
    async (
      trigger: WorkflowTrigger,
      pluginId: string,
      failurePolicy: PluginWorkflowFailurePolicy,
    ) => {
      const workflow = workflows[trigger] ?? { trigger, steps: [] };
      await persistWorkflow({
        trigger: workflow.trigger,
        steps: workflow.steps.map((step) =>
          step.pluginId === pluginId ? { ...step, failurePolicy } : step,
        ),
      });
    },
    [persistWorkflow, workflows],
  );

  const workflowPluginsByTrigger = useMemo(
    () =>
      Object.fromEntries(
        WORKFLOW_TRIGGERS.map((trigger) => {
          const workflow = workflows[trigger] ?? { trigger, steps: [] };
          return [
            trigger,
            workflow.steps
              .map((step) => ({
                step,
                plugin: plugins.find((plugin) => plugin.manifest.id === step.pluginId) ?? null,
              }))
              .filter((entry) => entry.plugin != null),
          ];
        }),
      ) as Record<
        WorkflowTrigger,
        Array<{ step: PluginTriggerWorkflow['steps'][number]; plugin: PluginSummary | null }>
      >,
    [plugins, workflows],
  );

  const availableWorkflowPluginsByTrigger = useMemo(
    () =>
      Object.fromEntries(
        WORKFLOW_TRIGGERS.map((trigger) => {
          const workflow = workflows[trigger] ?? { trigger, steps: [] };
          return [
            trigger,
            plugins.filter(
              (plugin) =>
                plugin.installation.enabled &&
                plugin.manifest.triggers.includes(trigger) &&
                !workflow.steps.some((step) => step.pluginId === plugin.manifest.id),
            ),
          ];
        }),
      ) as Record<WorkflowTrigger, PluginSummary[]>,
    [plugins, workflows],
  );

  const selectedPlugin =
    selectedPluginId != null
      ? (plugins.find((plugin) => plugin.manifest.id === selectedPluginId) ?? null)
      : null;

  const loadPluginLogs = useCallback(
    async (pluginId: string, mode: 'replace' | 'append' = 'replace') => {
      const limit = 60;
      const offset = mode === 'append' ? pluginLogsOffset : 0;

      if (mode === 'append') {
        setLogsLoadingMore(true);
      } else {
        setLogsLoading(true);
        setPluginLogs([]);
        setPluginLogsTotal(0);
        setPluginLogsHasMore(false);
        setPluginLogsOffset(0);
      }

      setPluginLogsError(null);
      try {
        const result = await invoke<PluginLogsPage>('get_plugin_logs', {
          pluginId,
          limit,
          offset,
        });
        setPluginLogs((current) =>
          mode === 'append' ? [...current, ...result.items] : result.items,
        );
        setPluginLogsTotal(result.total);
        setPluginLogsHasMore(result.has_more);
        setPluginLogsOffset(offset + result.items.length);
      } catch (err) {
        console.error('Failed to load plugin logs:', err);
        setPluginLogsError(t('download.pluginLogsLoadError'));
      } finally {
        if (mode === 'append') {
          setLogsLoadingMore(false);
        } else {
          setLogsLoading(false);
        }
      }
    },
    [pluginLogsOffset, t],
  );

  const handleOpenPluginLogs = useCallback(
    async (pluginId: string) => {
      setSelectedPluginId(pluginId);
      setLogsOpen(true);
      await loadPluginLogs(pluginId, 'replace');
    },
    [loadPluginLogs],
  );

  const handleLoadMorePluginLogs = useCallback(async () => {
    if (!selectedPluginId || logsLoadingMore || !pluginLogsHasMore) return;
    await loadPluginLogs(selectedPluginId, 'append');
  }, [loadPluginLogs, logsLoadingMore, pluginLogsHasMore, selectedPluginId]);

  const handleClearPluginLogs = useCallback(async () => {
    if (!selectedPluginId) return;
    setClearLogsConfirmOpen(true);
  }, [selectedPluginId]);

  const handleConfirmClearPluginLogs = useCallback(async () => {
    if (!selectedPluginId) return;
    setLogsClearing(true);
    setPluginLogsError(null);
    try {
      await invoke('clear_plugin_logs', {
        pluginId: selectedPluginId,
      });
      setPluginLogs([]);
      setPluginLogsTotal(0);
      setPluginLogsHasMore(false);
      setPluginLogsOffset(0);
      setClearLogsConfirmOpen(false);
    } catch (err) {
      console.error('Failed to clear plugin logs:', err);
      setPluginLogsError(t('download.pluginLogsClearError'));
    } finally {
      setLogsClearing(false);
    }
  }, [selectedPluginId, t]);

  const closeLogsDialog = useCallback(() => {
    setLogsOpen(false);
    setSelectedPluginId(null);
    setPluginLogs([]);
    setPluginLogsTotal(0);
    setPluginLogsHasMore(false);
    setPluginLogsOffset(0);
    setPluginLogsError(null);
  }, []);

  return {
    availableWorkflowPluginsByTrigger,
    clearLogsConfirmOpen,
    closeLogsDialog,
    handleAddWorkflowPlugin,
    handleClearPluginLogs,
    handleConfirmClearPluginLogs,
    handleLoadMorePluginLogs,
    handleMoveWorkflowStep,
    handleOpenPluginLogs,
    handleRemoveWorkflowStep,
    handleWorkflowFailurePolicy,
    loadPluginLogs,
    logsClearing,
    logsLoading,
    logsLoadingMore,
    logsOpen,
    pluginLogs,
    pluginLogsError,
    pluginLogsHasMore,
    pluginLogsOffset,
    pluginLogsTotal,
    selectedPlugin,
    selectedPluginId,
    setClearLogsConfirmOpen,
    setSelectedPluginId,
    workflowPluginsByTrigger,
  };
}
