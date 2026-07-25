import { AlertTriangle, CheckCircle2, Download, Loader2, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDependencies } from '@/contexts/DependenciesContext';

interface FFmpegRequiredDialogProps {
  quality: string;
  onDismiss: () => void;
  onContinue: () => void;
  onGoToSettings?: () => void;
}

export function FFmpegRequiredDialog({
  quality,
  onDismiss,
  onContinue,
  onGoToSettings,
}: FFmpegRequiredDialogProps) {
  const { ffmpegDownloading, ffmpegError, ffmpegSuccess, downloadFfmpeg } = useDependencies();

  const handleGoToSettings = () => {
    onDismiss();
    onGoToSettings?.();
  };

  const handleInstall = async () => {
    await downloadFfmpeg();
  };

  if (ffmpegSuccess) {
    setTimeout(() => {
      onContinue();
    }, 1500);
  }

  const qualityLabel = quality === 'best' ? 'Best quality' : quality.toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ffmpeg-required-title"
        className="w-full max-w-md border border-border bg-card rounded-md shadow-none overflow-hidden"
      >
        <div className="relative flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-panel text-amber-500">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="min-w-0 pr-8">
            <h2 id="ffmpeg-required-title" className="text-sm font-semibold tracking-tight">
              FFmpeg Required
            </h2>
            <p className="text-xs text-muted-foreground">For {qualityLabel} video downloads</p>
          </div>
          {!ffmpegDownloading ? (
            <button
              type="button"
              onClick={onDismiss}
              className="absolute top-3.5 right-3.5 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>

        <div className="px-5 py-4">
          {ffmpegDownloading ? (
            <div className="text-center space-y-3 py-2">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-panel">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
              <p className="text-sm text-muted-foreground">
                Downloading FFmpeg... This may take a few minutes.
              </p>
            </div>
          ) : ffmpegSuccess ? (
            <div className="text-center space-y-3 py-2">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-panel text-emerald-500">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <p className="text-sm text-muted-foreground">
                FFmpeg installed successfully! You can now download {qualityLabel} videos.
              </p>
            </div>
          ) : ffmpegError ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 p-3">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{ffmpegError}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                You can try again or install FFmpeg manually from Settings.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                High-resolution videos ({qualityLabel}) require FFmpeg to merge separate video and
                audio streams from YouTube.
              </p>
              <div className="rounded-md border border-border bg-panel p-3">
                <p className="text-xs font-medium text-foreground mb-1.5">Without FFmpeg:</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Download may fail or produce errors</li>
                  <li>Video may have no audio</li>
                  <li>Limited to lower quality (720p or below)</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border bg-panel/50">
          {ffmpegDownloading ? (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" disabled>
                <Loader2 className="w-4 h-4 animate-spin" />
                Installing...
              </Button>
            </div>
          ) : ffmpegSuccess ? (
            <div className="flex justify-end">
              <Button size="sm" onClick={onContinue}>
                <CheckCircle2 className="w-4 h-4" />
                Continue
              </Button>
            </div>
          ) : ffmpegError ? (
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={onContinue}>
                Continue Anyway
              </Button>
              <Button size="sm" onClick={handleInstall}>
                Try Again
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Button className="w-full" onClick={handleInstall}>
                <Download className="w-4 h-4" />
                Install FFmpeg
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={handleGoToSettings}>
                  <Settings className="w-4 h-4" />
                  Go to Settings
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 text-muted-foreground"
                  onClick={onContinue}
                >
                  Continue Anyway
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
