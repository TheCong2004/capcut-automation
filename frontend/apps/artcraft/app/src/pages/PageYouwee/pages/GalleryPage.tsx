import { ExternalLink, Play, RefreshCw, Square, Trash2, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GalleryQueueList } from '@/components/download/GalleryQueueList';
import { GallerySettingsPanel } from '@/components/download/GallerySettingsPanel';
import { GalleryUrlInput } from '@/components/download/GalleryUrlInput';
import { ThemePicker } from '@/components/settings/ThemePicker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/card';
import { useDependencies } from '@/contexts/DependenciesContext';
import { useGalleryDl } from '@/contexts/gallerydl-context';
import { cn } from '@/lib/utils';

interface GalleryPageProps {
  onNavigateToSettings?: () => void;
}

export function GalleryPage({ onNavigateToSettings }: GalleryPageProps) {
  const { t } = useTranslation('gallery');
  const {
    items,
    focusedItemId,
    isDownloading,
    settings,
    error,
    addFromText,
    importFromFile,
    importFromClipboard,
    selectOutputFolder,
    removeItem,
    clearAll,
    clearCompleted,
    startDownload,
    stopDownload,
    updateConcurrentDownloads,
  } = useGalleryDl();
  const { galleryDlStatus, galleryDlLoading, galleryDlError, checkGalleryDl } = useDependencies();

  const pendingCount = items.filter((i) => i.status !== 'completed').length;
  const hasItems = items.length > 0;
  const isReady = galleryDlStatus?.installed === true;

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
          {!isReady && (
            <Badge
              variant="outline"
              className="h-5 border-amber-500/40 px-1.5 text-[10px] text-amber-600 dark:text-amber-400"
            >
              {t('missing.title')}
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

            {!isReady && (
              <Panel className="border-amber-500/30 bg-amber-500/5 p-3 sm:p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <TriangleAlert className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t('missing.title')}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {galleryDlLoading
                            ? t('missing.checking')
                            : galleryDlError || error || t('missing.description')}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void checkGalleryDl()}
                        disabled={galleryDlLoading}
                        title={t('missing.refresh')}
                        className="h-8 w-8 shrink-0"
                      >
                        <RefreshCw className={cn('h-4 w-4', galleryDlLoading && 'animate-spin')} />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {onNavigateToSettings && (
                        <Button variant="outline" size="sm" onClick={onNavigateToSettings}>
                          {t('missing.openDependencies')}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href="https://github.com/mikf/gallery-dl"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t('missing.installGuide')}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              </Panel>
            )}

            <GalleryUrlInput
              disabled={!isReady}
              onAddUrls={addFromText}
              onImportFile={importFromFile}
              onImportClipboard={importFromClipboard}
            />
          </section>

          <section
            aria-label={t('queue.title')}
            className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-5"
          >
            <GalleryQueueList
              items={items}
              focusedItemId={focusedItemId}
              isDownloading={isDownloading}
              onRemove={removeItem}
              onClearCompleted={clearCompleted}
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
            <GallerySettingsPanel
              settings={settings}
              disabled={!isReady || isDownloading}
              onSelectFolder={selectOutputFolder}
              onConcurrentChange={updateConcurrentDownloads}
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
            {!isDownloading ? (
              <>
                <Button
                  type="button"
                  className="h-10 flex-1 gap-2"
                  onClick={() => void startDownload()}
                  disabled={!isReady || pendingCount === 0 || !settings.outputPath}
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
                <Button
                  variant="outline"
                  className="h-10 gap-2 px-3"
                  onClick={clearAll}
                  disabled={isDownloading}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('actions.clearAll')}</span>
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  className="h-10 flex-1 gap-2"
                  onClick={() => void stopDownload()}
                  title={t('actions.stopDownload')}
                >
                  <Square className="h-4 w-4" />
                  <span>{t('actions.stopDownload')}</span>
                </Button>
                <Button variant="outline" className="h-10 gap-2 px-3" disabled>
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('actions.clearAll')}</span>
                </Button>
              </>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
