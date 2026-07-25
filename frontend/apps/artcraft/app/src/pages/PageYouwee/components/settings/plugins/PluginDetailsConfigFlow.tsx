import { RefreshCw } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SettingsCard } from '../SettingsSection';
import { PluginDetailDialogs } from './PluginDetailDialogs';
import { PluginInstalledCard } from './PluginInstalledCard';
import type { PostDownloadPluginsCardController } from './usePostDownloadPluginsCard';

type PluginDetailsConfigFlowProps = Pick<
  PostDownloadPluginsCardController,
  | 'closePluginGuide'
  | 'error'
  | 'expandedPluginId'
  | 'getConfigDraftValue'
  | 'getTimeoutDraftValue'
  | 'handleApprovePermissions'
  | 'handleClearPluginConfig'
  | 'handleConfirmUninstallPlugin'
  | 'handleEnablePluginWithPermissions'
  | 'handleOpenPluginDirectory'
  | 'handleOpenPluginLogs'
  | 'handlePickPluginConfigPath'
  | 'handleRefreshPlugin'
  | 'handleResetPluginTimeout'
  | 'handleSavePluginConfig'
  | 'handleSavePluginTimeout'
  | 'handleSetPluginProvider'
  | 'handleTogglePlugin'
  | 'handleUninstallPlugin'
  | 'loadPlugins'
  | 'loading'
  | 'openPluginGuide'
  | 'permissionDialogPlugin'
  | 'permissionDialogState'
  | 'pluginGuideDialog'
  | 'plugins'
  | 'runtimeStatuses'
  | 'setConfigDraftValue'
  | 'setExpandedPluginId'
  | 'setPermissionDialogPlugin'
  | 'setPermissionDialogState'
  | 'setTimeoutDraftValue'
  | 'setUninstallTarget'
  | 'uninstallTarget'
>;

export const PluginDetailsConfigFlow = memo(function PluginDetailsConfigFlow(
  props: PluginDetailsConfigFlowProps,
) {
  const { t } = useTranslation('settings');
  const controller = props;

  return (
    <>
      <SettingsCard className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">{t('download.pluginsTitle')}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={controller.loadPlugins}
            disabled={controller.loading}
          >
            <RefreshCw className={cn('h-4 w-4', controller.loading && 'animate-spin')} />
            {t('download.pluginReload')}
          </Button>
        </div>

        {controller.error && <p className="text-xs text-destructive">{controller.error}</p>}

        {controller.loading ? (
          <p className="text-sm text-muted-foreground">{t('download.pluginLoading')}</p>
        ) : controller.plugins.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/70 bg-panel px-4 py-6 text-center">
            <p className="text-sm font-medium">{t('download.pluginEmptyTitle')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('download.pluginEmptyDesc')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {controller.plugins.map((plugin) => (
              <PluginInstalledCard
                key={plugin.manifest.id}
                controller={controller}
                plugin={plugin}
              />
            ))}
          </div>
        )}
      </SettingsCard>

      <PluginDetailDialogs controller={controller} />
    </>
  );
});
