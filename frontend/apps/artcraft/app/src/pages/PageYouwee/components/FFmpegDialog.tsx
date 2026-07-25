import { AlertTriangle, CheckCircle2, Download, Film, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDependencies } from '@/contexts/DependenciesContext';

interface FFmpegDialogProps {
  onDismiss: () => void;
}

export function FFmpegDialog({ onDismiss }: FFmpegDialogProps) {
  const { ffmpegStatus, ffmpegDownloading, ffmpegError, ffmpegSuccess, downloadFfmpeg } =
    useDependencies();

  if (ffmpegStatus?.installed || ffmpegSuccess) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ffmpeg-dialog-title"
        className="w-full max-w-md border border-border bg-card rounded-md shadow-none overflow-hidden"
      >
        <div className="relative flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-panel text-primary">
            <Film className="w-4 h-4" />
          </div>
          <div className="min-w-0 pr-8">
            <h2 id="ffmpeg-dialog-title" className="text-sm font-semibold tracking-tight">
              FFmpeg Required
            </h2>
            <p className="text-xs text-muted-foreground">For high-quality video downloads</p>
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
              <p className="text-sm text-muted-foreground">FFmpeg installed successfully!</p>
            </div>
          ) : ffmpegError ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 p-3">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{ffmpegError}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                You can try again or install FFmpeg manually later from Settings.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                FFmpeg is required for downloading high-resolution videos (2K, 4K) where YouTube
                provides separate video and audio streams that need to be merged.
              </p>
              <div className="rounded-md border border-border bg-panel p-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">What happens without FFmpeg:</strong>
                  <br />
                  Downloads above 1080p may fail or produce video-only files without audio.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border bg-panel/50 flex gap-2 justify-end">
          {ffmpegDownloading ? (
            <Button variant="outline" size="sm" disabled>
              <Loader2 className="w-4 h-4 animate-spin" />
              Installing...
            </Button>
          ) : ffmpegSuccess ? (
            <Button size="sm" onClick={onDismiss}>
              Continue
            </Button>
          ) : ffmpegError ? (
            <>
              <Button variant="outline" size="sm" onClick={onDismiss}>
                Skip
              </Button>
              <Button size="sm" onClick={downloadFfmpeg}>
                Try Again
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={onDismiss}>
                Skip for Now
              </Button>
              <Button size="sm" onClick={downloadFfmpeg}>
                <Download className="w-4 h-4" />
                Install FFmpeg
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
