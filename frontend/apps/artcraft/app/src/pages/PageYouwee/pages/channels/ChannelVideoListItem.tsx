import { Check, CheckCircle2, Clock, Loader2, Play, Tv, XCircle } from 'lucide-react';
import {
  ThumbnailCompletedBadge,
  ThumbnailFailedBadge,
} from '@/components/download/ThumbnailStatusBadge';
import type { VideoDownloadState } from '@/contexts/channels/useChannelsController';
import type { PlaylistVideoEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatUploadDate(dateStr?: string): string {
  if (!dateStr) return '';
  if (dateStr.length === 8) {
    const y = dateStr.slice(0, 4);
    const m = dateStr.slice(4, 6);
    const d = dateStr.slice(6, 8);
    return `${y}-${m}-${d}`;
  }
  return dateStr;
}

type ChannelVideoListItemProps = {
  video: PlaylistVideoEntry;
  isSelected: boolean;
  videoState?: VideoDownloadState;
  onToggle: () => void;
};

export function ChannelVideoListItem({
  video,
  isSelected,
  videoState,
  onToggle,
}: ChannelVideoListItemProps) {
  const isActive = videoState?.status === 'downloading';
  const isCompleted = videoState?.status === 'completed';
  const isError = videoState?.status === 'error';
  const isPending = videoState?.status === 'pending';

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'group flex w-full gap-2.5 rounded-md border p-1.5 text-left transition-colors duration-150',
        'border-border bg-card hover:bg-muted/40',
        isSelected && !videoState && 'border-primary/40 bg-primary/5',
        isActive && 'border-primary/40 bg-primary/5',
        isCompleted && 'border-emerald-500/30 bg-emerald-500/5',
        isError && 'border-red-500/30 bg-red-500/5',
      )}
    >
      <div className="flex shrink-0 items-center pl-0.5">
        <div
          className={cn(
            'flex h-4 w-4 items-center justify-center rounded-sm border transition-colors duration-150',
            isSelected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-muted-foreground/40 group-hover:border-muted-foreground/70',
          )}
        >
          {isSelected && <Check className="h-2.5 w-2.5" />}
        </div>
      </div>

      <div className="relative h-[64px] w-28 shrink-0 overflow-hidden rounded-md border border-border bg-muted sm:h-[72px] sm:w-32">
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt=""
            className={cn(
              'h-full w-full object-cover transition-opacity duration-150',
              isCompleted && 'opacity-80',
            )}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <Tv className="h-6 w-6 text-muted-foreground/30" />
          </div>
        )}

        {video.duration && !isActive && (
          <span className="absolute right-1 bottom-1 rounded-sm bg-black/75 px-1 py-px font-mono text-[10px] font-medium text-white tabular-nums">
            {formatDuration(video.duration)}
          </span>
        )}

        {isActive && (
          <div className="absolute inset-x-0 bottom-0 bg-black/75 p-1.5">
            <div className="mb-1 h-1 overflow-hidden rounded-sm bg-white/20">
              <div
                className="h-full rounded-sm bg-primary transition-all duration-150"
                style={{ width: `${videoState?.progress || 0}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-medium text-white/90">
              <span>{(videoState?.progress || 0).toFixed(0)}%</span>
              {videoState?.speed && <span>{videoState.speed}</span>}
            </div>
          </div>
        )}

        {isCompleted && <ThumbnailCompletedBadge />}
        {isError && <ThumbnailFailedBadge />}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center py-0.5">
        <p
          className={cn(
            'line-clamp-2 text-sm leading-snug font-medium transition-colors',
            isCompleted && 'text-muted-foreground',
          )}
          title={video.title}
        >
          {video.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {videoState && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium',
                isPending && 'border-border bg-muted text-muted-foreground',
                isActive && 'border-primary/30 bg-primary/10 text-primary',
                isCompleted &&
                  'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                isError && 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
              )}
            >
              {isPending && <Clock className="h-3 w-3" />}
              {isActive && <Loader2 className="h-3 w-3 animate-spin" />}
              {isCompleted && <CheckCircle2 className="h-3 w-3" />}
              {isError && <XCircle className="h-3 w-3" />}
              <span>
                {isPending && 'Pending'}
                {isActive && `${(videoState.progress || 0).toFixed(0)}%`}
                {isCompleted && 'Completed'}
                {isError && 'Failed'}
              </span>
            </span>
          )}

          {video.upload_date && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatUploadDate(video.upload_date)}
            </span>
          )}

          {video.duration && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Play className="h-3 w-3" />
              {formatDuration(video.duration)}
            </span>
          )}

          {isError && videoState?.error && (
            <span className="line-clamp-1 text-[11px] text-red-500/80" title={videoState.error}>
              {videoState.error}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
