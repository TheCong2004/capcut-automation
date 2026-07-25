import {
  ArrowRight,
  Check,
  Download,
  Info,
  RefreshCw,
  Rocket,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SimpleMarkdown } from '@/components/ui/simple-markdown';
import type { UpdateInfo, UpdateProgress, UpdateStatus } from '@/hooks/useAppUpdater';
import { cn } from '@/lib/utils';

function getLocalizedBody(updateInfo: UpdateInfo | null, lang: string): string | undefined {
  if (!updateInfo) return undefined;
  if (lang.startsWith('vi')) return updateInfo.bodyVi || updateInfo.body;
  if (lang.startsWith('zh')) return updateInfo.bodyZhCN || updateInfo.body;
  return updateInfo.body;
}

interface UpdateDialogProps {
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  progress: UpdateProgress | null;
  error: string | null;
  onDownload: () => void;
  onRestart: () => void;
  onDismiss: () => void;
  onRetry: () => void;
}

export function UpdateDialog({
  status,
  updateInfo,
  progress,
  error,
  onDownload,
  onRestart,
  onDismiss,
  onRetry,
}: UpdateDialogProps) {
  const { t, i18n } = useTranslation('common');

  if (
    status === 'idle' ||
    status === 'checking' ||
    status === 'up-to-date' ||
    status === 'external'
  ) {
    return null;
  }

  const progressPercent =
    progress && progress.total > 0 ? Math.round((progress.downloaded / progress.total) * 100) : 0;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
  };

  const localizedBody = getLocalizedBody(updateInfo, i18n.language);
  const canDismiss = status === 'available' || status === 'error';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-background/70">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-dialog-title"
        className="relative w-full max-w-lg max-h-[calc(100vh-2rem)] border border-border bg-card rounded-md shadow-none overflow-hidden flex flex-col"
      >
        {canDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150 z-20"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}

        <div className="flex items-center gap-3 border-b border-border px-5 py-4 pr-12">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border',
              status === 'error'
                ? 'bg-destructive/10 text-destructive'
                : status === 'ready'
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : 'bg-panel text-primary',
            )}
          >
            {status === 'error' ? (
              <Info className="w-5 h-5" />
            ) : status === 'ready' ? (
              <Check className="w-5 h-5" />
            ) : (
              <Rocket className="w-5 h-5" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h2 id="update-dialog-title" className="text-base font-semibold tracking-tight">
              {status === 'error'
                ? t('update.error')
                : status === 'ready'
                  ? t('update.ready')
                  : t('update.available')}
            </h2>

            {updateInfo && status !== 'error' ? (
              <div className="mt-1.5 inline-flex items-center gap-2 rounded-md border border-border bg-panel px-2 py-0.5 text-xs font-medium">
                <span className="text-muted-foreground line-through">
                  v{updateInfo.currentVersion}
                </span>
                <ArrowRight className="w-3 h-3 text-primary" />
                <span className="text-primary">v{updateInfo.version}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="px-5 py-4 flex-1 min-h-0 overflow-y-auto">
          {status === 'available' ? (
            <div>
              {localizedBody ? (
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('update.description')}
                    </h3>
                  </div>
                  <SimpleMarkdown
                    content={localizedBody}
                    className={cn(
                      'text-sm text-foreground/85 space-y-2.5',
                      '[&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-foreground',
                      '[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-foreground',
                      '[&_h3]:text-sm [&_h3]:font-medium',
                      '[&_ul]:list-none [&_ul]:pl-0 [&_ul]:space-y-1.5',
                      '[&_li]:relative [&_li]:pl-4',
                      "[&_li::before]:content-[''] [&_li::before]:absolute [&_li::before]:left-1 [&_li::before]:top-2 [&_li::before]:w-1 [&_li::before]:h-1 [&_li::before]:bg-primary [&_li::before]:rounded-full",
                    )}
                  />
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground">{t('update.description')}</p>
              )}
            </div>
          ) : null}

          {status === 'downloading' ? (
            <div className="rounded-md border border-border bg-panel p-4">
              <div className="flex justify-between items-end mb-2">
                <span className="text-sm font-medium">{t('update.downloading')}</span>
                <span className="text-lg font-semibold tabular-nums text-primary">
                  {progressPercent}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-[width] duration-150 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              {progress && progress.total > 0 ? (
                <div className="mt-2 text-xs text-muted-foreground tabular-nums">
                  {formatBytes(progress.downloaded)} / {formatBytes(progress.total)}
                </div>
              ) : null}
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-center">
              <p className="text-sm text-destructive font-medium">
                {error || t('update.errorGeneric')}
              </p>
            </div>
          ) : null}
        </div>

        <div className="px-5 py-3 border-t border-border bg-panel/50 flex flex-col-reverse sm:flex-row gap-2">
          {status === 'available' ? (
            <>
              <Button variant="ghost" className="sm:w-1/3" onClick={onDismiss}>
                {t('update.later')}
              </Button>
              <Button className="sm:w-2/3" onClick={onDownload}>
                {t('update.updateNow')}
                <Download className="w-4 h-4" />
              </Button>
            </>
          ) : null}

          {status === 'downloading' ? (
            <Button variant="secondary" className="w-full" disabled>
              <RefreshCw className="w-4 h-4 animate-spin" />
              {t('update.downloading')}
            </Button>
          ) : null}

          {status === 'ready' ? (
            <Button className="w-full" onClick={onRestart}>
              {t('update.restartNow')}
              <RotateCcw className="w-4 h-4" />
            </Button>
          ) : null}

          {status === 'error' ? (
            <>
              <Button variant="ghost" className="sm:w-1/3" onClick={onDismiss}>
                {t('update.dismiss')}
              </Button>
              <Button className="sm:w-2/3" onClick={onRetry}>
                <RefreshCw className="w-4 h-4" />
                {t('update.retry')}
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
