import {
  Check,
  CheckSquare,
  ChevronRight,
  Clock,
  Download,
  Heart,
  Link,
  ListPlus,
  Loader2,
  RefreshCw,
  Search,
  Square,
  Tv,
  X,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FFmpegRequiredDialog } from '@/components/FFmpegRequiredDialog';
import { ThemePicker } from '@/components/settings/ThemePicker';
import { EmptyState } from '@/components/shared/EmptyStateIllustration';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { detectPlatform, isSupportedPlatform } from '@/contexts/channels/useChannelsController';
import { useChannels } from '@/contexts/channels-context';
import { useDependencies } from '@/contexts/DependenciesContext';
import type {
  Format,
  PreferredFps,
  Quality,
  VideoCodec,
  YoutubeChannelContentType,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { ChannelDetailView } from '@/pages/channels/ChannelDetailView';
import { ChannelFetchLoadingState } from '@/pages/channels/ChannelFetchLoadingState';
import { ChannelSettingsBar } from '@/pages/channels/ChannelSettingsBar';
import { ChannelVideoListItem } from '@/pages/channels/ChannelVideoListItem';
import {
  FFMPEG_REQUIRED_QUALITIES,
  getYoutubeContentTypeFromUrl,
  isYoutubeChannelContentUrl,
  loadInitialSettings,
} from '@/pages/channels/channelUtils';
import { PlatformTag } from '@/pages/channels/PlatformTag';

export function ChannelsPage() {
  const { t } = useTranslation('channels');
  const {
    followedChannels,
    refreshChannels,
    followChannel,
    unfollowChannel,
    browseUrl,
    setBrowseUrl,
    browseVideos,
    browseLoading,
    browseError,
    browseChannelName,
    fetchChannelVideos,
    clearBrowse,
    selectedVideoIds,
    toggleVideoSelection,
    selectAllVideos,
    deselectAllVideos,
    downloadSelectedVideos,
    stopDownload,
    isDownloading,
    videoStates,
    outputPath,
    selectOutputFolder,
    activeChannel,
    setActiveChannel,
    channelNewCounts,
    browseChannelAvatar,
    browseFetchProgress,
    browseHasMore,
    browseLoadingMore,
    browseYoutubeContentType,
    loadMoreChannelVideos,
    stopChannelFetch,
  } = useChannels();

  const { ffmpegStatus } = useDependencies();

  const [urlInput, setUrlInput] = useState(browseUrl);
  const [youtubeContentType, setYoutubeContentType] =
    useState<YoutubeChannelContentType>(browseYoutubeContentType);
  const [followingUrl, setFollowingUrl] = useState(false);
  const [channelsCollapsed, setChannelsCollapsed] = useState(false);
  const showYoutubeContentType = isYoutubeChannelContentUrl(urlInput.trim());

  const [initSettings] = useState(loadInitialSettings);
  const [quality, setQuality] = useState<Quality>(initSettings.quality);
  const [format, setFormat] = useState<Format>(initSettings.format);
  const [videoCodec, setVideoCodec] = useState<VideoCodec>(initSettings.videoCodec);
  const [preferredFps, setPreferredFps] = useState<PreferredFps>(initSettings.preferredFps);
  const [isAudioMode, setIsAudioMode] = useState(initSettings.isAudioMode);

  const [showFfmpegDialog, setShowFfmpegDialog] = useState(false);
  const [pendingQuality, setPendingQuality] = useState<Quality | null>(null);

  const handleAudioModeToggle = useCallback(() => {
    setIsAudioMode((prev) => {
      const next = !prev;
      if (next) {
        setQuality('audio');
        setFormat('mp3');
      } else {
        setQuality('best');
        setFormat('mp4');
      }
      return next;
    });
  }, []);

  const handleQualityChange = useCallback(
    (q: Quality) => {
      if (FFMPEG_REQUIRED_QUALITIES.includes(q) && ffmpegStatus?.installed === false) {
        setPendingQuality(q);
        setShowFfmpegDialog(true);
        return;
      }
      setQuality(q);
    },
    [ffmpegStatus?.installed],
  );

  const handleFfmpegDialogContinue = useCallback(() => {
    setShowFfmpegDialog(false);
    if (pendingQuality) {
      setQuality(pendingQuality);
    }
    setPendingQuality(null);
  }, [pendingQuality]);

  const handleFfmpegDialogDismiss = useCallback(() => {
    setShowFfmpegDialog(false);
    setPendingQuality(null);
  }, []);

  const handleFetch = useCallback(() => {
    if (browseLoading || browseLoadingMore) {
      stopChannelFetch();
      return;
    }

    const url = urlInput.trim();
    if (!url) return;
    if (!isSupportedPlatform(url)) {
      return;
    }
    const contentType = isYoutubeChannelContentUrl(url) ? youtubeContentType : 'videos';
    setBrowseUrl(url);
    fetchChannelVideos(url, undefined, contentType);
  }, [
    browseLoading,
    browseLoadingMore,
    fetchChannelVideos,
    setBrowseUrl,
    stopChannelFetch,
    urlInput,
    youtubeContentType,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleFetch();
      }
    },
    [handleFetch],
  );

  const ffmpegRequired =
    FFMPEG_REQUIRED_QUALITIES.includes(quality) && ffmpegStatus?.installed === false;

  const handleStartDownload = useCallback(async () => {
    if (ffmpegRequired) {
      setShowFfmpegDialog(true);
      return;
    }
    try {
      await downloadSelectedVideos(quality, format, videoCodec, preferredFps);
    } catch (error) {
      console.error('Download failed:', error);
    }
  }, [downloadSelectedVideos, quality, format, videoCodec, preferredFps, ffmpegRequired]);

  const handleFollow = useCallback(async () => {
    if (!browseChannelName || !browseUrl) return;
    setFollowingUrl(true);
    try {
      const thumbnail =
        browseChannelAvatar || (browseVideos.length > 0 ? browseVideos[0].thumbnail : undefined);
      await followChannel(
        browseUrl,
        browseChannelName,
        thumbnail ?? undefined,
        {
          quality: isAudioMode ? 'audio' : quality,
          format,
          videoCodec,
          preferredFps,
          audioBitrate: '192',
        },
        isYoutubeChannelContentUrl(browseUrl) ? youtubeContentType : 'videos',
      );
    } catch (error) {
      console.error('Follow failed:', error);
    } finally {
      setFollowingUrl(false);
    }
  }, [
    browseUrl,
    browseChannelName,
    browseChannelAvatar,
    browseVideos,
    followChannel,
    quality,
    format,
    videoCodec,
    preferredFps,
    isAudioMode,
    youtubeContentType,
  ]);

  const isAlreadyFollowing = followedChannels.some(
    (c) => c.url === browseUrl || c.url === urlInput.trim(),
  );

  const followedChannelId = followedChannels.find(
    (c) => c.url === browseUrl || c.url === urlInput.trim(),
  )?.id;

  const [confirmBrowseUnfollow, setConfirmBrowseUnfollow] = useState(false);
  const [confirmPanelUnfollowId, setConfirmPanelUnfollowId] = useState<string | null>(null);

  const handleBrowseUnfollow = useCallback(async () => {
    if (!followedChannelId) return;
    await unfollowChannel(followedChannelId);
    setConfirmBrowseUnfollow(false);
  }, [followedChannelId, unfollowChannel]);

  const pendingCount = selectedVideoIds.size;

  if (activeChannel) {
    return <ChannelDetailView channel={activeChannel} onBack={() => setActiveChannel(null)} />;
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex h-12 flex-shrink-0 items-center justify-between gap-3 border-b border-border px-4 sm:h-14 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="truncate text-sm font-semibold tracking-tight sm:text-base">
            {t('title')}
          </h1>
          {followedChannels.length > 0 && (
            <Badge variant="secondary" className="tabular-nums">
              {followedChannels.length} {t('following')}
            </Badge>
          )}
        </div>
        <ThemePicker />
      </header>

      <section className="flex-shrink-0 space-y-2.5 border-b border-border bg-panel/50 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Link className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="url"
              value={urlInput}
              onChange={(e) => {
                const nextUrl = e.target.value;
                setUrlInput(nextUrl);
                if (isYoutubeChannelContentUrl(nextUrl)) {
                  setYoutubeContentType(getYoutubeContentTypeFromUrl(nextUrl));
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder={t('urlPlaceholder')}
              disabled={browseLoading}
              className="h-9 pr-8 pl-8 text-sm"
            />
            {urlInput && (
              <button
                type="button"
                onClick={() => {
                  setUrlInput('');
                  setYoutubeContentType('videos');
                  clearBrowse();
                }}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button
            type="button"
            variant={browseLoading || browseLoadingMore ? 'destructive' : 'default'}
            size="sm"
            className="h-9 gap-1.5"
            onClick={handleFetch}
            disabled={!browseLoading && !browseLoadingMore && !urlInput.trim()}
            title={browseLoading || browseLoadingMore ? t('stopFetch') : t('fetchVideos')}
          >
            {browseLoading || browseLoadingMore ? (
              <Square className="h-3.5 w-3.5" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">
              {browseLoading || browseLoadingMore ? t('stopFetch') : t('fetchVideos')}
            </span>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
            {t('supportedSites')}:
          </span>
          <PlatformTag platform="youtube" size="xs" />
          <PlatformTag platform="bilibili" size="xs" />
          <PlatformTag platform="youku" size="xs" />
        </div>

        <ChannelSettingsBar
          quality={quality}
          format={format}
          videoCodec={videoCodec}
          preferredFps={preferredFps}
          isAudioMode={isAudioMode}
          onQualityChange={handleQualityChange}
          onFormatChange={setFormat}
          onVideoCodecChange={setVideoCodec}
          onPreferredFpsChange={setPreferredFps}
          onAudioModeToggle={handleAudioModeToggle}
          outputPath={outputPath}
          onSelectFolder={selectOutputFolder}
          youtubeContentType={youtubeContentType}
          onYoutubeContentTypeChange={setYoutubeContentType}
          showYoutubeContentType={showYoutubeContentType}
          disabled={isDownloading}
        />
      </section>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {browseChannelName && (
            <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5 sm:px-5">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                  {browseChannelAvatar ? (
                    <img
                      src={browseChannelAvatar}
                      alt=""
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Tv className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="truncate text-sm font-semibold leading-tight">
                      {browseChannelName}
                    </h2>
                    <PlatformTag platform={detectPlatform(browseUrl)} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t('videoCount', { count: browseVideos.length })}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {isAlreadyFollowing ? (
                  confirmBrowseUnfollow ? (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleBrowseUnfollow}
                        className="h-7 px-2.5 text-xs"
                      >
                        {t('unfollow')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmBrowseUnfollow(false)}
                        className="h-7 px-2.5 text-xs"
                      >
                        {t('cancel')}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setConfirmBrowseUnfollow(true)}
                      className="h-7 gap-1 px-2.5 text-xs"
                    >
                      <Check className="h-3 w-3" />
                      {t('following')}
                    </Button>
                  )
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFollow}
                    disabled={followingUrl}
                    className="h-7 gap-1.5"
                  >
                    {followingUrl ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Heart className="h-3.5 w-3.5" />
                    )}
                    {t('follow')}
                  </Button>
                )}
              </div>
            </div>
          )}

          {browseVideos.length > 0 && (
            <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-1.5 sm:px-5">
              <span className="text-xs text-muted-foreground">
                {selectedVideoIds.size > 0
                  ? t('selected', { count: selectedVideoIds.size })
                  : t('videoCount', { count: browseVideos.length })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={
                  selectedVideoIds.size === browseVideos.length
                    ? deselectAllVideos
                    : selectAllVideos
                }
                className="h-7 gap-1 text-xs"
                disabled={isDownloading}
              >
                {selectedVideoIds.size === browseVideos.length ? (
                  <CheckSquare className="h-3.5 w-3.5" />
                ) : (
                  <Square className="h-3.5 w-3.5" />
                )}
                {selectedVideoIds.size === browseVideos.length ? t('deselectAll') : t('selectAll')}
              </Button>
            </div>
          )}

          <div className="relative min-h-0 flex-1">
            <div className="h-full overflow-y-auto px-4 pt-2 sm:px-5">
              {browseError && (
                <Panel className="mx-auto my-8 max-w-md p-5 text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-destructive/30 bg-destructive/10">
                    <X className="h-5 w-5 text-destructive" />
                  </div>
                  <p className="text-sm font-medium text-destructive">{t('error.fetchFailed')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{browseError}</p>
                </Panel>
              )}

              {!browseLoading &&
                browseVideos.length === 0 &&
                !browseError &&
                !browseChannelName && (
                  <EmptyState
                    icon={Tv}
                    size="sm"
                    title={followedChannels.length === 0 ? t('noChannels') : t('browseChannel')}
                    description={
                      followedChannels.length === 0 ? t('noChannelsDescription') : t('description')
                    }
                    className="h-full"
                  />
                )}

              {browseLoading && <ChannelFetchLoadingState progress={browseFetchProgress} />}

              {browseVideos.length > 0 && (
                <div className="flex flex-col gap-1 pb-16">
                  {browseVideos.map((video) => (
                    <ChannelVideoListItem
                      key={video.id}
                      video={video}
                      isSelected={selectedVideoIds.has(video.id)}
                      videoState={videoStates.get(video.id)}
                      onToggle={() => toggleVideoSelection(video.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {(browseHasMore || browseLoadingMore) && browseVideos.length > 0 && (
              <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 px-4">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={loadMoreChannelVideos}
                  disabled={browseLoadingMore}
                  className="pointer-events-auto h-8 gap-1.5 border border-border"
                >
                  {browseLoadingMore ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ListPlus className="h-3.5 w-3.5" />
                  )}
                  <span>{t('loadMore')}</span>
                </Button>
              </div>
            )}
          </div>
        </div>

        {followedChannels.length > 0 && (
          <aside
            className={cn(
              'flex flex-shrink-0 flex-col overflow-hidden border-l border-border bg-panel/30 transition-[width] duration-150',
              channelsCollapsed ? 'w-10' : 'w-60',
            )}
          >
            <div className="flex items-center justify-between gap-1 border-b border-border px-2 py-2">
              {!channelsCollapsed && (
                <h3 className="px-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {t('followedChannels')}
                </h3>
              )}
              <div className={cn('flex items-center gap-0.5', channelsCollapsed && 'mx-auto')}>
                {!channelsCollapsed && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => refreshChannels()}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setChannelsCollapsed((prev) => !prev)}
                  title={channelsCollapsed ? 'Expand' : 'Collapse'}
                >
                  <ChevronRight
                    className={cn(
                      'h-3.5 w-3.5 transition-transform duration-150',
                      !channelsCollapsed && 'rotate-180',
                    )}
                  />
                </Button>
              </div>
            </div>

            {!channelsCollapsed && (
              <div className="flex-1 space-y-0.5 overflow-y-auto p-1.5">
                {followedChannels.map((channel) => (
                  <div key={channel.id} className="group relative">
                    {confirmPanelUnfollowId === channel.id ? (
                      <div className="flex items-center gap-1 rounded-md border border-destructive/25 bg-destructive/5 p-2">
                        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                          {t('confirmUnfollow')}
                        </p>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => {
                            unfollowChannel(channel.id);
                            setConfirmPanelUnfollowId(null);
                          }}
                        >
                          {t('unfollow')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => setConfirmPanelUnfollowId(null)}
                        >
                          {t('cancel')}
                        </Button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveChannel(channel);
                          }}
                          className="flex w-full cursor-pointer items-center gap-2 rounded-md border border-transparent p-2 text-left transition-colors duration-150 hover:border-border hover:bg-muted/50"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                            {channel.thumbnail ? (
                              <img
                                src={channel.thumbnail}
                                alt=""
                                className="h-full w-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <Tv className="h-3.5 w-3.5 text-muted-foreground/50" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-xs font-medium">{channel.name}</p>
                              <PlatformTag platform={channel.platform} size="xs" />
                              {(channelNewCounts[channel.id] || 0) > 0 && (
                                <span className="flex h-[16px] min-w-[16px] shrink-0 items-center justify-center rounded-sm bg-primary px-1 text-[10px] leading-none font-bold text-primary-foreground">
                                  {channelNewCounts[channel.id] > 99
                                    ? '99+'
                                    : channelNewCounts[channel.id]}
                                </span>
                              )}
                            </div>
                            {channel.last_checked_at && (
                              <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                                <Clock className="h-2.5 w-2.5" />
                                {new Date(channel.last_checked_at).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmPanelUnfollowId(channel.id);
                          }}
                          className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-sm opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:bg-destructive/15 hover:text-destructive"
                          title={t('unfollow')}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>

      {(pendingCount > 0 || isDownloading) && (
        <footer className="flex-shrink-0 border-t border-border bg-panel px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            {!isDownloading ? (
              <Button
                type="button"
                className="h-9 flex-1 gap-2"
                onClick={handleStartDownload}
                disabled={pendingCount === 0}
              >
                <Download className="h-4 w-4" />
                <span>{t('downloadSelected')}</span>
                {pendingCount > 0 && (
                  <Badge variant="secondary" className="bg-primary-foreground/15 text-primary-foreground">
                    {pendingCount}
                  </Badge>
                )}
              </Button>
            ) : (
              <Button className="h-9 flex-1" variant="destructive" onClick={stopDownload}>
                <Square className="mr-2 h-4 w-4" />
                Stop Download
              </Button>
            )}

            <Button
              variant="outline"
              size="icon"
              onClick={deselectAllVideos}
              disabled={isDownloading}
              className="h-9 w-9 shrink-0"
              title={t('deselectAll')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </footer>
      )}

      {showFfmpegDialog && (
        <FFmpegRequiredDialog
          quality={pendingQuality || quality}
          onDismiss={handleFfmpegDialogDismiss}
          onContinue={handleFfmpegDialogContinue}
        />
      )}
    </div>
  );
}
