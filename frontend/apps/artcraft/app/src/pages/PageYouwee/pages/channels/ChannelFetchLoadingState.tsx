import { Tv } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyStateIllustration } from '@/components/shared/EmptyStateIllustration';
import { Panel } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type ChannelFetchProgress = {
  fetched: number;
  limit?: number | null;
};

type ChannelFetchLoadingStateProps = {
  progress?: ChannelFetchProgress | null;
};

export function ChannelFetchLoadingState({ progress }: ChannelFetchLoadingStateProps) {
  const { t } = useTranslation('channels');
  const progressText = progress
    ? progress.limit
      ? `${progress.fetched}/${progress.limit}`
      : String(progress.fetched)
    : null;

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <EmptyStateIllustration className="mb-4" icon={Tv} size="sm" isActive />
      <Panel className="mt-1 w-full max-w-sm p-3 text-left">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-primary">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            {t('fetching')}
          </div>
          {progressText && (
            <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
              {progressText}
            </span>
          )}
        </div>
        <div className="mt-3 space-y-2">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-primary/60" />
              <span
                className={cn(
                  'h-1.5 animate-pulse rounded-sm bg-muted',
                  index === 0 && 'w-11/12',
                  index === 1 && 'w-8/12',
                  index === 2 && 'w-10/12',
                )}
              />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
