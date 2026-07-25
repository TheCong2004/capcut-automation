import { Play, Square, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserCookieErrorDialog } from '@/pages/PageYouwee/components/BrowserCookieErrorDialog';
import {
  ScheduleActiveControls,
  SchedulePopover,
  UniversalQueueList,
  UniversalSettingsPanel,
  UniversalUrlInput,
} from '@/pages/PageYouwee/components/download';
import { FFmpegRequiredDialog } from '@/pages/PageYouwee/components/FFmpegRequiredDialog';
import { FreshCookieRequiredDialog } from '@/pages/PageYouwee/components/FreshCookieRequiredDialog';
import { ThemePicker } from '@/pages/PageYouwee/components/settings/ThemePicker';
import { Badge } from '@/pages/PageYouwee/components/ui/badge';
import { Button } from '@/pages/PageYouwee/components/ui/button';
import { useDependencies } from '@/pages/PageYouwee/contexts/DependenciesContext';
import { useUniversal } from '@/pages/PageYouwee/contexts/universal-context';
import { useSchedule } from '@/pages/PageYouwee/hooks/useSchedule';
import { loadCookieSettings } from '@/pages/PageYouwee/lib/network-config';
import type { Quality } from '@/pages/PageYouwee/lib/types';

const FFMPEG_REQUIRED_QUALITIES: Quality[] = ['best', '8k', '4k', '2k'];

interface UniversalPageProps {
  onNavigateToSettings?: () => void;
}

export function UniversalPage({ onNavigateToSettings }: UniversalPageProps) {
  const { t } = useTranslation('universal');
  const {
    items,
    focusedItemId,
    isDownloading,
    settings,
    addFromText,
    importFromFile,
    importFromClipboard,
    selectOutputFolder,
    removeItem,
    clearAll,
    clearCompleted,
    startDownload,
    stopDownload,
    updateQuality,
    updateFormat,
    updateVideoCodec,
    updateAudioBitrate,
    updatePreferredFps,
    updateConcurrentDownloads,
    updateLiveFromStart,
    updateSkipLive,
    cookieError,
    clearCookieError,
    retryFailedDownload,
    updateItemTimeRange,
    selectItemOutputFolder,
    renameCompletedItem,
  } = useUniversal();

  const { ffmpegStatus } = useDependencies();
  const [showFfmpegDialog, setShowFfmpegDialog] = useState(false);

  const schedule = useSchedule({
    storageKey: 'youwee-schedule-universal',
    onStart: startDownload,
    onStop: stopDownload,
    isDownloading,
    sourceLabel: 'Universal',
  });

  const pendingCount = items.filter((i) => i.status !== 'completed').length;
  const hasItems = items.length > 0;
  const ffmpegRequired =
    FFMPEG_REQUIRED_QUALITIES.includes(settings.quality) && ffmpegStatus?.installed === false;

  const handleStartDownload = () => {
    if (ffmpegRequired) {
      setShowFfmpegDialog(true);
      return;
    }
    startDownload();
  };

  const handleFfmpegDialogContinue = () => {
    setShowFfmpegDialog(false);
    startDownload();
  };

  const totalFileSize = items.reduce((sum, item) => sum + (item.filesize || 0), 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-4 sm:h-14 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="truncate text-sm font-semibold tracking-tight sm:text-base">{t('title')}</h1>
          {hasItems && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] tabular-nums">
              {items.length}
            </Badge>
          )}
          {isDownloading && (
            <Badge className="h-5 bg-primary/15 px-1.5 text-[10px] text-primary hover:bg-primary/15">
              {t('queue.status.downloading')}
            </Badge>
          )}
        </div>
        <ThemePicker />
      </header>

      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <section
            aria-label={t('layout.command')}
            className="shrink-0 space-y-3 border-b border-border bg-panel/40 p-4 sm:p-5"
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="h-3 w-0.5 rounded-full bg-primary" aria-hidden />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t('layout.command')}
              </span>
            </div>
            <UniversalUrlInput
              onAddUrls={addFromText}
              onImportFile={importFromFile}
              onImportClipboard={importFromClipboard}
            />
          </section>

          <section
            aria-label={t('queue.title')}
            className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-5"
          >
            <UniversalQueueList
              items={items}
              focusedItemId={focusedItemId}
              isDownloading={isDownloading}
              onRemove={removeItem}
              onUpdateTimeRange={updateItemTimeRange}
              onSelectOutputFolder={selectItemOutputFolder}
              onRename={renameCompletedItem}
              onClearCompleted={clearCompleted}
              onScheduleUpcomingLive={schedule.setSchedule}
            />
          </section>
        </div>

        <aside
          aria-label={t('layout.inspector')}
          className="shrink-0 border-t border-border bg-panel/50 xl:w-72 xl:overflow-y-auto xl:border-l xl:border-t-0 2xl:w-80"
        >
          <div className="space-y-3 p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <span className="h-3 w-0.5 rounded-full bg-primary" aria-hidden />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t('layout.inspector')}
              </span>
            </div>
            <UniversalSettingsPanel
              settings={settings}
              disabled={isDownloading}
              totalFileSize={totalFileSize > 0 ? totalFileSize : undefined}
              onQualityChange={updateQuality}
              onFormatChange={updateFormat}
              onVideoCodecChange={updateVideoCodec}
              onAudioBitrateChange={updateAudioBitrate}
              onPreferredFpsChange={updatePreferredFps}
              onConcurrentChange={updateConcurrentDownloads}
              onSelectFolder={selectOutputFolder}
              onLiveFromStartChange={updateLiveFromStart}
              onSkipLiveChange={updateSkipLive}
            />
          </div>
        </aside>
      </div>

      {hasItems && (
        <footer
          aria-label={t('layout.actionDock')}
          className="shrink-0 border-t border-border bg-card px-4 py-3 sm:px-5"
        >
          <div className="flex items-center gap-2 sm:gap-3">
            {!isDownloading && !schedule.isScheduled ? (
              <>
                <Button
                  type="button"
                  className="h-10 flex-1 gap-2"
                  onClick={handleStartDownload}
                  disabled={pendingCount === 0}
                  title={t('actions.startDownload')}
                >
                  <Play className="h-4 w-4" />
                  <span>{t('actions.startDownload')}</span>
                  {pendingCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-0.5 h-5 min-w-5 bg-primary-foreground/20 px-1.5 text-[10px] text-primary-foreground"
                    >
                      {pendingCount}
                    </Badge>
                  )}
                </Button>
                <SchedulePopover
                  onSchedule={schedule.setSchedule}
                  disabled={pendingCount === 0}
                  ns="universal"
                  triggerVariant="inline"
                  triggerLabel={t('schedule.setSchedule')}
                  triggerClassName="h-10 shrink-0 rounded-md px-3 text-sm font-medium"
                />
              </>
            ) : schedule.isScheduled && !isDownloading ? (
              <ScheduleActiveControls
                schedule={schedule.schedule}
                countdown={schedule.countdown}
                onCancel={schedule.cancelSchedule}
                onStartNow={() => {
                  schedule.cancelSchedule();
                  handleStartDownload();
                }}
                ns="universal"
              />
            ) : (
              <Button
                className="h-10 flex-1 gap-2"
                variant="destructive"
                onClick={stopDownload}
                title={t('actions.stopDownload')}
              >
                <Square className="h-4 w-4" />
                {t('actions.stopDownload')}
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={clearAll}
              disabled={isDownloading || items.length === 0}
              className="h-10 w-10 shrink-0"
              title={t('actions.clearAll')}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </footer>
      )}

      {showFfmpegDialog && (
        <FFmpegRequiredDialog
          quality={settings.quality}
          onDismiss={() => setShowFfmpegDialog(false)}
          onContinue={handleFfmpegDialogContinue}
          onGoToSettings={onNavigateToSettings}
        />
      )}

      {(() => {
        const itemId = cookieError?.itemId;
        if (!cookieError?.show || !itemId) return null;
        if (cookieError.kind === 'fresh_cookies') {
          return (
            <FreshCookieRequiredDialog
              onDismiss={clearCookieError}
              onGoToSettings={onNavigateToSettings}
            />
          );
        }
        return (
          <BrowserCookieErrorDialog
            browserName={loadCookieSettings().browser}
            onRetry={() => retryFailedDownload(itemId)}
            onDismiss={clearCookieError}
            onGoToSettings={onNavigateToSettings}
          />
        );
      })()}
    </div>
  );
}
