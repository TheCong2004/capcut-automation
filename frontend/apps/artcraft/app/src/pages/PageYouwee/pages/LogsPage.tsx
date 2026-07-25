import { ScrollText, Terminal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LogEntry, LogToolbar } from '@/components/logs';
import { ThemePicker } from '@/components/settings/ThemePicker';
import { EmptyState } from '@/components/shared/EmptyStateIllustration';
import { Panel } from '@/components/ui/card';
import { useLogs } from '@/contexts/LogContext';

const INITIAL_VISIBLE_LOGS = 40;
const LOG_RENDER_BATCH_SIZE = 120;

export function LogsPage() {
  const { t } = useTranslation('pages');
  const { logs, loading } = useLogs();
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_LOGS);
  const visibleLogs = useMemo(() => logs.slice(0, visibleCount), [logs, visibleCount]);

  useEffect(() => {
    setVisibleCount(logs.length === 0 ? 0 : Math.min(INITIAL_VISIBLE_LOGS, logs.length));
  }, [logs]);

  useEffect(() => {
    if (visibleCount >= logs.length) return;

    const timeout = window.setTimeout(() => {
      setVisibleCount((current) => Math.min(logs.length, current + LOG_RENDER_BATCH_SIZE));
    }, 32);

    return () => window.clearTimeout(timeout);
  }, [logs.length, visibleCount]);

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex h-12 flex-shrink-0 items-center justify-between gap-3 border-b border-border px-4 sm:h-14 sm:px-5">
        <h1 className="truncate text-sm font-semibold tracking-tight sm:text-base">
          {t('logs.title')}
        </h1>
        <ThemePicker />
      </header>

      <section className="flex-shrink-0 border-b border-border bg-panel/50 px-4 py-3 sm:px-5">
        <LogToolbar />
      </section>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3 sm:px-5">
        <Panel className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
            {loading && logs.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="animate-pulse text-sm text-muted-foreground">{t('logs.loading')}</p>
              </div>
            ) : logs.length === 0 ? (
              <EmptyState
                icon={ScrollText}
                title={t('logs.emptyTitle')}
                description={t('logs.emptyDescription')}
                className="h-full"
                action={
                  <div className="inline-flex max-w-md items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-left">
                    <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <code className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                      yt-dlp --newline -f "bestvideo+bestaudio" -o "..." URL
                    </code>
                  </div>
                }
              />
            ) : (
              <div className="divide-y divide-border">
                {visibleLogs.map((log) => (
                  <LogEntry key={log.id} log={log} />
                ))}
              </div>
            )}
          </div>
        </Panel>
      </main>
    </div>
  );
}
