import { AlertTriangle, CheckCircle2, Loader2, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDependencies } from '@/contexts/DependenciesContext';

interface DenoDialogProps {
  onDismiss: () => void;
}

export function DenoDialog({ onDismiss }: DenoDialogProps) {
  const { denoStatus, denoDownloading, denoError, denoSuccess, downloadDeno } = useDependencies();

  if (denoStatus?.installed || denoSuccess) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deno-dialog-title"
        className="w-full max-w-md border border-border bg-card rounded-md shadow-none overflow-hidden"
      >
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-panel text-primary">
            <Terminal className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 id="deno-dialog-title" className="text-sm font-semibold tracking-tight">
              Setting Up YouTube Support
            </h2>
            <p className="text-xs text-muted-foreground">Installing Deno runtime</p>
          </div>
        </div>

        <div className="px-5 py-4">
          {denoDownloading ? (
            <div className="text-center space-y-3 py-2">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-panel">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
              <p className="text-sm text-muted-foreground">
                Downloading Deno runtime... This is required for YouTube downloads.
              </p>
              <p className="text-xs text-muted-foreground/80">This only needs to happen once.</p>
            </div>
          ) : denoSuccess ? (
            <div className="text-center space-y-3 py-2">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-panel text-emerald-500">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <p className="text-sm text-muted-foreground">Deno installed successfully!</p>
              <p className="text-xs text-muted-foreground/80">
                YouTube downloads are now fully supported.
              </p>
            </div>
          ) : denoError ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 p-3">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{denoError}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                You can try again or install Deno manually later from Settings.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Deno is a JavaScript runtime required for YouTube video extraction.
              </p>
              <div className="rounded-md border border-border bg-panel p-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Why is this needed?</strong>
                  <br />
                  YouTube uses JavaScript challenges to protect video streams. Deno helps solve
                  these challenges to enable downloads.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border bg-panel/50 flex gap-2 justify-end">
          {denoDownloading ? (
            <Button variant="outline" size="sm" disabled>
              <Loader2 className="w-4 h-4 animate-spin" />
              Installing...
            </Button>
          ) : denoSuccess ? (
            <Button size="sm" onClick={onDismiss}>
              Continue
            </Button>
          ) : denoError ? (
            <>
              <Button variant="outline" size="sm" onClick={onDismiss}>
                Skip
              </Button>
              <Button size="sm" onClick={downloadDeno}>
                Try Again
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
