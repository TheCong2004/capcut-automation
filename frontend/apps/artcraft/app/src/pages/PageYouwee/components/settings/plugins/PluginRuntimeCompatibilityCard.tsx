import { PackageOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PluginProvider, PluginSummary } from '@/lib/types';
import {
  currentProvider,
  formatRuntimeStatusBadge,
  PROVIDER_LABELS,
  summarizeCompatibility,
} from './post-download-plugins-shared';
import type { PostDownloadPluginsCardController } from './usePostDownloadPluginsCard';

type PluginRuntimeCompatibilityCardControllerProps = Pick<
  PostDownloadPluginsCardController,
  'handleSetPluginProvider' | 'runtimeStatuses'
>;

export function PluginRuntimeCompatibilityCard({
  controller,
  plugin,
}: {
  controller: PluginRuntimeCompatibilityCardControllerProps;
  plugin: PluginSummary;
}) {
  const { t } = useTranslation('settings');
  const selectedProvider = currentProvider(plugin);
  const supportedProviders = plugin.manifest.runtime.supportedProviders;
  const compatibilityEntries = summarizeCompatibility(plugin.manifest.compatibility, t);
  const runtimeStatus = controller.runtimeStatuses[plugin.manifest.id];

  return (
    <div className="rounded-md bg-card p-3">
      <div className="flex items-center gap-2 text-xs font-medium">
        <PackageOpen className="h-4 w-4 text-blue-500" />
        <span>{t('download.pluginCompatibilityTitle')}</span>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {t('download.pluginCompatibilityDesc')}
      </p>
      <div className="mt-3 space-y-3 text-[11px] text-muted-foreground">
        <div>
          <p className="font-medium text-foreground/80">{t('download.pluginProviderTitle')}</p>
          <p className="mt-1">{t('download.pluginProviderDesc')}</p>
          <div className="mt-2">
            <Select
              value={selectedProvider}
              onValueChange={(value) =>
                controller.handleSetPluginProvider(plugin, value as PluginProvider)
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {supportedProviders.map((provider) => (
                  <SelectItem key={provider} value={provider} className="text-xs">
                    {PROVIDER_LABELS[provider]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          {compatibilityEntries.length > 0 ? (
            compatibilityEntries.map((entry) => <p key={entry}>{entry}</p>)
          ) : (
            <p>{t('download.pluginCompatibilityNone')}</p>
          )}
        </div>

        {plugin.installation.lastResolvedProvider && (
          <p>
            {t('download.pluginLastResolvedProvider')}:{' '}
            {PROVIDER_LABELS[plugin.installation.lastResolvedProvider]}
          </p>
        )}
        {plugin.installation.lastResolvedSource && (
          <p>
            {t('download.pluginLastResolvedSource')}: {plugin.installation.lastResolvedSource}
          </p>
        )}
        {plugin.installation.lastExecutionStatus && (
          <p>
            {t('download.pluginLastExecutionStatus')}:{' '}
            {formatRuntimeStatusBadge(plugin.installation.lastExecutionStatus, t)}
          </p>
        )}
        {(runtimeStatus?.status === 'error' || plugin.installation.lastError) && (
          <p className="text-destructive">
            {t('download.pluginLastError')}:{' '}
            {runtimeStatus?.status === 'error'
              ? runtimeStatus.message
              : plugin.installation.lastError}
          </p>
        )}
        {runtimeStatus?.status === 'running' && (
          <p className="text-sky-600 dark:text-sky-400">{t('download.pluginRunningNow')}</p>
        )}
        {plugin.warnings.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {plugin.warnings.map((warning) => (
              <span
                key={`${plugin.manifest.id}-${warning}`}
                className="rounded bg-amber-500/10 px-2 py-1 text-[11px] text-amber-600 dark:text-amber-400"
              >
                {warning}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
