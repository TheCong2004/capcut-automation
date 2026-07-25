import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PluginSummary } from '@/lib/types';
import {
  formatChecksum,
  formatPackageFormat,
  formatPluginIdentifier,
  formatSignatureStatus,
  formatSignerFingerprint,
  formatSourceKind,
  LANGUAGE_LABELS,
  PROVIDER_LABELS,
} from './post-download-plugins-shared';
import type { PostDownloadPluginsCardController } from './usePostDownloadPluginsCard';

type PluginPackageInfoCardControllerProps = Pick<
  PostDownloadPluginsCardController,
  | 'getTimeoutDraftValue'
  | 'handleResetPluginTimeout'
  | 'handleSavePluginTimeout'
  | 'setTimeoutDraftValue'
>;

export function PluginPackageInfoCard({
  controller,
  plugin,
}: {
  controller: PluginPackageInfoCardControllerProps;
  plugin: PluginSummary;
}) {
  const { t } = useTranslation('settings');

  return (
    <div className="rounded-md bg-card p-3">
      <div className="flex items-center gap-2 text-xs font-medium">
        <Info className="h-4 w-4 text-purple-500" />
        <span>{t('download.pluginPackageTitle')}</span>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{t('download.pluginPackageDesc')}</p>
      <div className="mt-3 grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-2">
        <DetailRow label={t('download.pluginIdentifierLabel')}>
          {formatPluginIdentifier(plugin.manifest.id, plugin.manifest.slug)}
        </DetailRow>
        <DetailRow label={t('download.pluginVersionLabel')}>v{plugin.manifest.version}</DetailRow>
        {plugin.manifest.author && (
          <DetailRow label={t('download.pluginAuthorLabel')}>{plugin.manifest.author}</DetailRow>
        )}
        {plugin.manifest.license && (
          <DetailRow label={t('download.pluginLicenseLabel')}>{plugin.manifest.license}</DetailRow>
        )}
        <DetailRow label={t('download.pluginSourceLabel')}>
          {formatSourceKind(plugin.installation.source.kind, t)}
        </DetailRow>
        {plugin.installation.source.packageFormat && (
          <DetailRow label={t('download.pluginPackageFormatLabel')}>
            {formatPackageFormat(
              plugin.installation.source.packageFormat,
              plugin.installation.source.packageFormatVersion,
            )}
          </DetailRow>
        )}
        {plugin.installation.source.builderSdkVersion && (
          <DetailRow label={t('download.pluginBuilderSdkVersionLabel')}>
            v{plugin.installation.source.builderSdkVersion}
          </DetailRow>
        )}
        {plugin.installation.signatureStatus && (
          <DetailRow label={t('download.pluginSignatureTitle')}>
            {formatSignatureStatus(plugin.installation.signatureStatus, t)}
          </DetailRow>
        )}
        {plugin.installation.signerFingerprint && (
          <DetailRow label={t('download.pluginSignerFingerprintLabel')}>
            {formatSignerFingerprint(plugin.installation.signerFingerprint)}
          </DetailRow>
        )}
        {plugin.installation.signatureAlgorithm && (
          <DetailRow label={t('download.pluginSignatureAlgorithmLabel')}>
            {plugin.installation.signatureAlgorithm}
          </DetailRow>
        )}
        {plugin.installation.signedAt && (
          <DetailRow label={t('download.pluginSignedAtLabel')}>
            {plugin.installation.signedAt}
          </DetailRow>
        )}
        <DetailRow label={t('download.pluginLanguageLabel')}>
          {LANGUAGE_LABELS[plugin.manifest.runtime.language]}
        </DetailRow>
        <div>
          <p className="font-medium text-foreground/80">{t('download.pluginTimeoutLabel')}</p>
          <div className="mt-1 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={controller.getTimeoutDraftValue(plugin)}
                onChange={(event) =>
                  controller.setTimeoutDraftValue(plugin.manifest.id, event.target.value)
                }
                className="h-8 text-xs"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => controller.handleSavePluginTimeout(plugin)}
              >
                {t('download.pluginTimeoutSave')}
              </Button>
            </div>
            <p>
              {plugin.installation.timeoutSecOverride
                ? t('download.pluginTimeoutOverrideHelp', {
                    seconds: plugin.manifest.timeoutSec,
                  })
                : t('download.pluginTimeoutDefaultHelp')}
            </p>
            {plugin.installation.timeoutSecOverride && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => controller.handleResetPluginTimeout(plugin)}
              >
                {t('download.pluginTimeoutUseDefault')}
              </Button>
            )}
          </div>
        </div>
        <DetailRow label={t('download.pluginSupportedProvidersLabel')}>
          {plugin.manifest.runtime.supportedProviders
            .map((provider) => PROVIDER_LABELS[provider])
            .join(', ')}
        </DetailRow>
        <DetailRow label={t('download.pluginTriggersLabel')} fullWidth>
          {plugin.manifest.triggers.join(', ')}
        </DetailRow>
        {plugin.manifest.homepage && (
          <DetailRow label={t('download.pluginHomepageLabel')} fullWidth>
            <a
              href={plugin.manifest.homepage}
              target="_blank"
              rel="noreferrer"
              className="break-all text-primary hover:underline"
            >
              {plugin.manifest.homepage}
            </a>
          </DetailRow>
        )}
        {plugin.manifest.repository && (
          <DetailRow label={t('download.pluginRepositoryLabel')} fullWidth>
            <a
              href={plugin.manifest.repository}
              target="_blank"
              rel="noreferrer"
              className="break-all text-primary hover:underline"
            >
              {plugin.manifest.repository}
            </a>
          </DetailRow>
        )}
        {plugin.manifest.publishedAt && (
          <DetailRow label={t('download.pluginPublishedAtLabel')} fullWidth>
            {plugin.manifest.publishedAt}
          </DetailRow>
        )}
        <DetailRow label={t('download.pluginLocationLabel')} fullWidth>
          <span className="break-all">{plugin.installation.source.value}</span>
        </DetailRow>
        {plugin.installation.source.checksum && (
          <DetailRow
            label={
              plugin.installation.source.packageFormat
                ? t('download.pluginPackageChecksumLabel')
                : t('download.pluginChecksumLabel')
            }
            fullWidth
          >
            <span className="break-all">
              {plugin.installation.source.packageFormat
                ? plugin.installation.source.checksum
                : formatChecksum(plugin.installation.source.checksum)}
            </span>
          </DetailRow>
        )}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  children,
  fullWidth = false,
}: {
  label: string;
  children: ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? 'sm:col-span-2' : undefined}>
      <p className="font-medium text-foreground/80">{label}</p>
      <p>{children}</p>
    </div>
  );
}
