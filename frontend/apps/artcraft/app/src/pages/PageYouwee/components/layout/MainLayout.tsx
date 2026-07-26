import { getCurrentWindow } from '@tauri-apps/api/window';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { isTauri } from '@/lib/tauri';
import type { Page } from './Sidebar';
import { Sidebar } from './Sidebar';

const isMacOS = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');
const isWindows = typeof navigator !== 'undefined' && navigator.platform.includes('Win');

/** Windows-only window control buttons (minimize / maximize-restore / close). */
function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri) return;
    const win = getCurrentWindow();
    win
      .isMaximized()
      .then(setMaximized)
      .catch(() => {});

    const unlisten = win.onResized(() => {
      win
        .isMaximized()
        .then(setMaximized)
        .catch(() => {});
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const btnBase =
    'w-[46px] h-full inline-flex items-center justify-center text-foreground/80 transition-colors duration-150';

  return (
    <div className="flex h-8 shrink-0">
      <button
        type="button"
        onClick={() => getCurrentWindow().minimize()}
        className={`${btnBase} hover:bg-muted`}
      >
        <svg width="10" height="1" viewBox="0 0 10 1" className="fill-current" aria-hidden="true">
          <rect width="10" height="1" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => getCurrentWindow().toggleMaximize()}
        className={`${btnBase} hover:bg-muted`}
      >
        {maximized ? (
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            className="fill-none stroke-current"
            strokeWidth="1"
            aria-hidden="true"
          >
            <rect x="0" y="2.5" width="7.5" height="7.5" />
            <polyline points="2.5,2.5 2.5,0 10,0 10,7.5 7.5,7.5" />
          </svg>
        ) : (
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            className="fill-none stroke-current"
            strokeWidth="1"
            aria-hidden="true"
          >
            <rect x="0.5" y="0.5" width="9" height="9" />
          </svg>
        )}
      </button>

      <button
        type="button"
        onClick={() => getCurrentWindow().close()}
        className={`${btnBase} hover:bg-destructive hover:text-destructive-foreground`}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          className="fill-none stroke-current"
          strokeWidth="1.2"
          aria-hidden="true"
        >
          <line x1="0" y1="0" x2="10" y2="10" />
          <line x1="10" y1="0" x2="0" y2="10" />
        </svg>
      </button>
    </div>
  );
}

interface MainLayoutProps {
  children: ReactNode;
  currentPage: Page;
  onPageChange: (page: Page) => void;
}

/**
 * North shell: titlebar drag region + left rail + flat main canvas.
 * Page routing stays outside; this only frames content.
 */
export function MainLayout({ children, currentPage, onPageChange }: MainLayoutProps) {
  const titlebarOffset = isTauri ? (isMacOS ? '2.5rem' : isWindows ? '2rem' : undefined) : undefined;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background text-foreground">
      {/* macOS: transparent drag region for overlay title bar */}
      {isMacOS && isTauri && (
        <div data-tauri-drag-region className="absolute top-0 left-0 right-0 z-30 h-10" />
      )}

      {/* Windows: custom title bar replacing native decorations */}
      {isWindows && isTauri && (
        <div className="absolute top-0 left-0 right-0 z-30 h-8 flex border-b border-border bg-background">
          <div
            role="toolbar"
            data-tauri-drag-region
            className="flex-1 h-full flex items-center px-3"
            onDoubleClick={() => isTauri && getCurrentWindow().toggleMaximize()}
          >
            <span className="pointer-events-none select-none text-[11px] font-medium tracking-wide text-muted-foreground">
              Youwee
            </span>
          </div>
          <WindowControls />
        </div>
      )}

      <div
        className="relative z-10 flex flex-1 min-h-0 min-w-0"
        style={titlebarOffset ? { paddingTop: titlebarOffset } : undefined}
      >
        <Sidebar currentPage={currentPage} onPageChange={onPageChange} />

        {/* Main canvas — flat, no floating glass card */}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
