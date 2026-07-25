import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faFacebook,
  faGithub,
  faReddit,
  faTelegram,
  faTwitter,
  faWeibo,
  faWhatsapp,
} from '@fortawesome/free-brands-svg-icons';
import { getVersion } from '@tauri-apps/api/app';
import {
  AlertTriangle,
  Bug,
  Check,
  CheckCircle2,
  Coffee,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Globe,
  Heart,
  Info,
  Loader2,
  RefreshCw,
  Settings,
  Share2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AISection,
  DependenciesSection,
  DownloadSection,
  ExtensionSection,
  GeneralSection,
  NetworkSection,
  PluginsSection,
  RemoteDownloadSection,
  SettingsRow,
  SettingsSearch,
  SettingsSection,
  type SettingsSectionId,
  SettingsSidebar,
} from '@/components/settings';
import { FaIcon } from '@/components/shared/FaIcon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { useDownload } from '@/contexts/download-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useUpdater } from '@/contexts/UpdaterContext';
import { cn } from '@/lib/utils';

export function SettingsPage({
  initialSection = 'general',
}: {
  initialSection?: SettingsSectionId;
}) {
  const { t } = useTranslation('settings');
  const [activeSection, setActiveSection] = useState<SettingsSectionId>(initialSection);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);

  const updater = useUpdater();

  useEffect(() => {
    getVersion().then(setAppVersion);
  }, []);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  const handleSearchNavigate = useCallback((section: SettingsSectionId, settingId: string) => {
    setActiveSection(section);
    setHighlightId(settingId);

    setTimeout(() => {
      const element = document.getElementById(settingId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setTimeout(() => setHighlightId(null), 2000);
    }, 100);
  }, []);

  const isAppChecking = updater.status === 'checking';
  const isAppUpdateAvailable = updater.status === 'available';
  const isAppUpToDate = updater.status === 'up-to-date';
  const isAppError = updater.status === 'error';
  const isAppExternalUpdater = updater.status === 'external';

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Page toolbar */}
      <div className="flex-shrink-0 px-4 sm:px-5 py-3 border-b border-border">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-panel text-primary">
              <Settings className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold tracking-tight text-foreground">{t('title')}</h1>
              <p className="text-xs text-muted-foreground truncate">{t('subtitle')}</p>
            </div>
          </div>
          <SettingsSearch onNavigate={handleSearchNavigate} />
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <SettingsSidebar activeSection={activeSection} onSectionChange={setActiveSection} />

        <ScrollArea className="flex-1">
          <div className="w-full px-4 sm:px-5 lg:px-6">
            <div ref={contentRef} className="mx-auto w-full max-w-5xl py-5">
              <div
                key={activeSection}
                className="transition-opacity duration-150 ease-out animate-in fade-in-0"
              >
                {activeSection === 'general' && <GeneralSection highlightId={highlightId} />}

                {activeSection === 'dependencies' && (
                  <DependenciesSection highlightId={highlightId} />
                )}

                {activeSection === 'download' && <DownloadSection highlightId={highlightId} />}

                {activeSection === 'remote-download' && (
                  <RemoteDownloadSection highlightId={highlightId} />
                )}

                {activeSection === 'plugins' && <PluginsSection highlightId={highlightId} />}

                {activeSection === 'extension' && <ExtensionSection highlightId={highlightId} />}

                {activeSection === 'ai' && <AISection highlightId={highlightId} />}

                {activeSection === 'network' && <NetworkSection highlightId={highlightId} />}

                {activeSection === 'about' && (
                  <AboutSettingsContent
                    appVersion={appVersion}
                    updater={updater}
                    isAppChecking={isAppChecking}
                    isAppUpdateAvailable={isAppUpdateAvailable}
                    isAppUpToDate={isAppUpToDate}
                    isAppError={isAppError}
                    isAppExternalUpdater={isAppExternalUpdater}
                    highlightId={highlightId}
                  />
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function AboutSettingsContent({
  appVersion,
  updater,
  isAppChecking,
  isAppUpdateAvailable,
  isAppUpToDate,
  isAppError,
  isAppExternalUpdater,
  highlightId,
}: {
  appVersion: string;
  updater: ReturnType<typeof useUpdater>;
  isAppChecking: boolean;
  isAppUpdateAvailable: boolean;
  isAppUpToDate: boolean;
  isAppError: boolean;
  isAppExternalUpdater: boolean;
  highlightId: string | null;
}) {
  const { t } = useTranslation('settings');
  const { t: tCommon } = useTranslation('common');
  const { settings, updateAutoCheckUpdate } = useDownload();
  const { mode } = useTheme();
  const [copied, setCopied] = useState(false);

  const appUrl = 'https://github.com/vanloctech/youwee';
  const websiteUrl = 'https://youwee.app';
  const docsUrl = 'https://youwee.app/docs';
  const buyMeACoffeeUrl = 'https://buymeacoffee.com/vanloctech';
  const redditUrl = 'https://www.reddit.com/r/youwee/';
  const productHuntUrl =
    'https://www.producthunt.com/products/youwee/reviews/new?utm_source=badge-product_review&utm_medium=badge&utm_source=badge-youwee';
  const productHuntBadgeUrl = `https://api.producthunt.com/widgets/embed-image/v1/product_review.svg?product_id=1154224&theme=${mode}`;
  const shareText = t('about.shareText');
  const encodedUrl = encodeURIComponent(appUrl);
  const encodedText = encodeURIComponent(shareText);

  const shareLinks: Array<{
    key: string;
    label: string;
    icon: IconDefinition;
    href: string;
  }> = [
    {
      key: 'x',
      label: 'X',
      icon: faTwitter,
      href: `https://x.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    },
    {
      key: 'facebook',
      label: 'Facebook',
      icon: faFacebook,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      key: 'reddit',
      label: 'Reddit',
      icon: faReddit,
      href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedText}`,
    },
    {
      key: 'telegram',
      label: 'Telegram',
      icon: faTelegram,
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      icon: faWhatsapp,
      href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${appUrl}`)}`,
    },
    {
      key: 'weibo',
      label: 'Weibo',
      icon: faWeibo,
      href: `https://service.weibo.com/share/share.php?url=${encodedUrl}&title=${encodedText}`,
    },
  ];

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      console.error('Failed to copy share link:', error);
    }
  };

  const linkChipClass =
    'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-background text-xs font-medium text-foreground hover:bg-muted transition-colors duration-150';

  return (
    <div className="space-y-6">
      <SettingsSection
        title={t('about.title')}
        description={t('about.description')}
        icon={<Info className="w-4 h-4" />}
      >
        {/* App identity */}
        <div
          id="app-version"
          className={cn(
            'rounded-md border border-border bg-card p-4 transition-[box-shadow] duration-150',
            highlightId === 'app-version' && 'ring-1 ring-primary/40',
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border">
                <img src="/logo-128.png" alt="Youwee" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-semibold tracking-tight">Youwee</span>
                  <Badge variant="secondary" className="font-mono text-[11px]">
                    v{appVersion}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{t('about.appDesc')}</p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {isAppChecking ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin text-primary" />
                      {t('about.checkingUpdates')}
                    </span>
                  ) : isAppUpdateAvailable && updater.updateInfo ? (
                    <span className="inline-flex items-center gap-1.5 text-primary font-medium">
                      <Download className="w-3 h-3" />
                      {t('about.versionAvailable', { version: updater.updateInfo.version })}
                    </span>
                  ) : isAppUpToDate ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-500">
                      <CheckCircle2 className="w-3 h-3" />
                      {t('about.upToDate')}
                    </span>
                  ) : isAppExternalUpdater ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Info className="w-3 h-3" />
                      {t('about.flatpakUpdates')}
                    </span>
                  ) : isAppError ? (
                    <span className="text-destructive">
                      {updater.error || t('about.checkFailed')}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isAppUpdateAvailable ? (
                <Button
                  size="sm"
                  onClick={updater.downloadAndInstall}
                  disabled={updater.status === 'downloading' || updater.status === 'ready'}
                >
                  {updater.status === 'downloading' || updater.status === 'ready' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {updater.status === 'downloading'
                        ? `${updater.progress ? Math.round((updater.progress.downloaded / updater.progress.total) * 100) : 0}%`
                        : t('about.restarting')}
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      {t('about.update')}
                    </>
                  )}
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="icon"
                onClick={updater.checkForUpdate}
                disabled={isAppChecking}
                title={t('about.checkForUpdates')}
                className="h-8 w-8"
              >
                <RefreshCw className={cn('w-4 h-4', isAppChecking && 'animate-spin')} />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-3 border-t border-border">
            <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className={linkChipClass}>
              <Globe className="w-3.5 h-3.5 text-muted-foreground" />
              {t('about.website')}
            </a>
            <a href={docsUrl} target="_blank" rel="noopener noreferrer" className={linkChipClass}>
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              {t('about.docs')}
            </a>
            <a
              href="https://github.com/vanloctech/youwee/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className={linkChipClass}
            >
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              {t('about.license')}
            </a>
            <a
              href="https://github.com/vanloctech/youwee/issues"
              target="_blank"
              rel="noopener noreferrer"
              className={linkChipClass}
            >
              <Bug className="w-3.5 h-3.5 text-muted-foreground" />
              {t('about.reportIssue')}
            </a>
          </div>
        </div>

        {/* Legal notice */}
        <div className="rounded-md border border-border bg-panel p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <h3 className="text-sm font-semibold">{tCommon('legalDisclaimer.title')}</h3>
          </div>
          <div className="space-y-2.5 text-xs leading-relaxed text-muted-foreground">
            <p>{tCommon('legalDisclaimer.description')}</p>
            <div className="rounded-md border-l-2 border-amber-500/70 bg-background px-3 py-2">
              <p className="font-medium text-foreground/90">{tCommon('legalDisclaimer.notice')}</p>
            </div>
            <p>{tCommon('legalDisclaimer.responsibility')}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <FaIcon icon={faGithub} className="text-[15px] text-muted-foreground" />
              <p className="text-sm font-semibold">{t('about.communityTitle')}</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              {t('about.communityDesc')}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <a
                href="https://github.com/vanloctech/youwee"
                target="_blank"
                rel="noopener noreferrer"
                className={linkChipClass}
              >
                <FaIcon icon={faGithub} className="text-[13px]" />
                GitHub
              </a>
              <a href={redditUrl} target="_blank" rel="noopener noreferrer" className={linkChipClass}>
                <FaIcon icon={faReddit} className="text-[12px]" />
                Reddit
              </a>
            </div>
            <div className="mt-3">
              <a
                href={productHuntUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full opacity-90 hover:opacity-100 transition-opacity duration-150"
              >
                <img
                  src={productHuntBadgeUrl}
                  alt={t('about.productHuntBadgeAlt')}
                  width={250}
                  height={54}
                  className="h-[54px] w-[250px] max-w-full rounded-md border border-border"
                />
              </a>
            </div>
          </div>

          <div className="rounded-md border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-semibold">{t('about.supportTitle')}</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              {t('about.supportDesc')}
            </p>
            <a
              href={buyMeACoffeeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-md border border-dashed border-border px-3 py-2.5 hover:border-primary/40 hover:bg-muted/40 transition-colors duration-150"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-panel text-primary">
                <Coffee className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <span>{t('about.buyMeACoffee')}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {t('about.buyMeACoffeeDesc')}
                </p>
              </div>
            </a>
          </div>
        </div>

        <div className="rounded-md border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Share2 className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm font-semibold">{t('about.shareTitle')}</p>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{t('about.shareDesc')}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {shareLinks.map((item) => (
              <a
                key={item.key}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={linkChipClass}
              >
                <FaIcon icon={item.icon} className="text-[13px]" />
                {item.label}
              </a>
            ))}
            <button
              type="button"
              onClick={handleCopyLink}
              className={cn(linkChipClass, copied && 'text-primary')}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              )}
              {copied ? t('about.copied') : t('about.copyLink')}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 py-1 text-xs text-muted-foreground">
          <span>{t('about.madeWith')}</span>
          <Heart className="w-3 h-3 text-primary fill-primary" />
          <span>{t('about.by')}</span>
          <a
            href="https://github.com/vanloctech"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground hover:text-primary transition-colors duration-150"
          >
            vanloctech
          </a>
        </div>

        <SettingsRow
          id="auto-update"
          label={t('about.autoUpdate')}
          description={t('about.autoUpdateDesc')}
          highlight={highlightId === 'auto-update'}
        >
          <Switch checked={settings.autoCheckUpdate} onCheckedChange={updateAutoCheckUpdate} />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
