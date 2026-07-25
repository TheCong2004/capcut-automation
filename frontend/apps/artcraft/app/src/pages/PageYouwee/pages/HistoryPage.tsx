import { FolderDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HistoryItem, HistoryToolbar } from '@/components/history';
import { ThemePicker } from '@/components/settings/ThemePicker';
import { EmptyState } from '@/components/shared/EmptyStateIllustration';
import { Badge } from '@/components/ui/badge';
import { useHistory } from '@/contexts/HistoryContext';

const INITIAL_VISIBLE_HISTORY_ITEMS = 10;
const HISTORY_RENDER_BATCH_SIZE = 40;

export function HistoryPage() {
  const { t } = useTranslation('pages');
  const { entries, loading, totalCount } = useHistory();
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_HISTORY_ITEMS);
  const visibleEntries = useMemo(() => entries.slice(0, visibleCount), [entries, visibleCount]);

  useEffect(() => {
    setVisibleCount(
      entries.length === 0 ? 0 : Math.min(INITIAL_VISIBLE_HISTORY_ITEMS, entries.length),
    );
  }, [entries]);

  useEffect(() => {
    if (visibleCount >= entries.length) return;

    const timeout = window.setTimeout(() => {
      setVisibleCount((current) => Math.min(entries.length, current + HISTORY_RENDER_BATCH_SIZE));
    }, 32);

    return () => window.clearTimeout(timeout);
  }, [entries.length, visibleCount]);

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex h-12 flex-shrink-0 items-center justify-between gap-3 border-b border-border px-4 sm:h-14 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="truncate text-sm font-semibold tracking-tight sm:text-base">
            {t('library.title')}
          </h1>
          {totalCount > 0 && (
            <Badge variant="secondary" className="tabular-nums">
              {t('library.downloads', { count: totalCount })}
            </Badge>
          )}
        </div>
        <ThemePicker />
      </header>

      <section className="flex-shrink-0 border-b border-border bg-panel/50 px-4 py-3 sm:px-5">
        <HistoryToolbar />
      </section>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          {loading && entries.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="animate-pulse text-sm text-muted-foreground">{t('library.loading')}</p>
            </div>
          ) : entries.length === 0 ? (
            <EmptyState
              icon={FolderDown}
              title={t('library.emptyTitle')}
              description={t('library.emptyDescription')}
              className="h-full"
            />
          ) : (
            <ul className="flex flex-col gap-1.5 pb-4">
              {visibleEntries.map((entry) => (
                <li key={entry.id}>
                  <HistoryItem entry={entry} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
