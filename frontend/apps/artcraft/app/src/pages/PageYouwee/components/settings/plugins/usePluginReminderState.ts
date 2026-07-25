import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/ui/toast';
import type { PluginSummary } from '@/lib/types';

export function usePluginReminderState() {
  const { t } = useTranslation('settings');
  const toast = useToast();
  const lastToastIdRef = useRef<string | null>(null);

  const showPluginReminderToast = useCallback(
    (plugin: PluginSummary) => {
      const toastId = `plugin-workflow-reminder:${plugin.manifest.id}`;
      lastToastIdRef.current = toastId;
      toast.warning({
        id: toastId,
        title: plugin.manifest.name,
        message: t('download.pluginWorkflowReminderToast'),
        durationMs: 5000,
      });
    },
    [t, toast],
  );

  return {
    showPluginReminderToast,
  };
}
