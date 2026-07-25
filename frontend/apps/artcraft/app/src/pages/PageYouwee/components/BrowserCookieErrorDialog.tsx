import { AlertTriangle, Cookie, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BrowserCookieErrorDialogProps {
  browserName?: string;
  onRetry: () => void;
  onDismiss: () => void;
  onGoToSettings?: () => void;
}

export function BrowserCookieErrorDialog({
  browserName = 'browser',
  onRetry,
  onDismiss,
  onGoToSettings,
}: BrowserCookieErrorDialogProps) {
  const displayBrowserName =
    browserName.charAt(0).toUpperCase() + browserName.slice(1).toLowerCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-error-title"
        className="w-full max-w-md border border-border bg-card rounded-md shadow-none overflow-hidden"
      >
        <div className="relative flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-panel text-amber-500">
            <Cookie className="w-4 h-4" />
          </div>
          <div className="min-w-0 pr-8">
            <h2 id="cookie-error-title" className="text-sm font-semibold tracking-tight">
              Cookie Access Failed
            </h2>
            <p className="text-xs text-muted-foreground">Browser is blocking cookie access</p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="flex items-start gap-2.5 rounded-md border border-amber-500/25 bg-amber-500/10 p-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">{displayBrowserName} is currently open</p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                Chromium-based browsers lock their cookie database while running. Please close{' '}
                {displayBrowserName} completely and try again.
              </p>
            </div>
          </div>

          <div className="rounded-md border border-border bg-panel p-3">
            <p className="text-xs font-medium text-foreground mb-1.5">To fix this issue:</p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Close all {displayBrowserName} windows</li>
              <li>
                Make sure {displayBrowserName} is not running in the background (check system tray)
              </li>
              <li>Click &quot;Retry Download&quot; below</li>
            </ol>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Alternative:</strong> Use &quot;Cookie File&quot;
            mode in Settings → Network to export cookies using a browser extension.
          </p>
        </div>

        <div className="px-5 py-3 border-t border-border bg-panel/50">
          <div className="flex flex-col gap-2">
            <Button className="w-full" onClick={onRetry}>
              <RefreshCw className="w-4 h-4" />
              Retry Download
            </Button>
            <div className="flex gap-2">
              {onGoToSettings ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    onDismiss();
                    onGoToSettings();
                  }}
                >
                  Go to Settings
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 text-muted-foreground"
                onClick={onDismiss}
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
