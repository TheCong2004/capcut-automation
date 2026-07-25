import { Cookie, KeyRound, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FreshCookieRequiredDialogProps {
  onDismiss: () => void;
  onGoToSettings?: () => void;
}

export function FreshCookieRequiredDialog({
  onDismiss,
  onGoToSettings,
}: FreshCookieRequiredDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fresh-cookie-title"
        className="w-full max-w-md border border-border bg-card rounded-md shadow-none overflow-hidden"
      >
        <div className="relative flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-panel text-primary">
            <Cookie className="w-4 h-4" />
          </div>
          <div className="min-w-0 pr-8">
            <h2 id="fresh-cookie-title" className="text-sm font-semibold tracking-tight">
              Login Cookies Required
            </h2>
            <p className="text-xs text-muted-foreground">
              This content requires authenticated cookies
            </p>
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
          <div className="flex items-start gap-2.5 rounded-md border border-border bg-panel p-3">
            <KeyRound className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">The video needs a logged-in session</p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                The current request does not have valid login cookies, or the cookies need to be
                refreshed.
              </p>
            </div>
          </div>

          <div className="rounded-md border border-border bg-panel p-3">
            <p className="text-xs font-medium text-foreground mb-1.5">To fix this issue:</p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Open Settings → Network</li>
              <li>Enable Browser Cookie mode or Cookie File mode</li>
              <li>If Browser Cookie mode is already enabled, refresh your login and try again</li>
            </ol>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border bg-panel/50">
          <div className="flex gap-2">
            {onGoToSettings ? (
              <Button
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
              variant={onGoToSettings ? 'ghost' : 'outline'}
              className="flex-1"
              onClick={onDismiss}
            >
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
