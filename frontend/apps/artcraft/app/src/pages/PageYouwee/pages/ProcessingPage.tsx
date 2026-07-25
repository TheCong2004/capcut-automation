import { Clock, FileDown, Film, History, Maximize2, Music, Zap } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChatPanel,
  HistoryDialog,
  PreviewConfirmDialog,
  VideoPlayer,
} from '@/components/processing';
import { ThemePicker } from '@/components/settings/ThemePicker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useProcessing } from '@/contexts/ProcessingContext';

export function ProcessingPage() {
  const { t } = useTranslation('pages');
  const {
    videoPath,
    videoSrc,
    audioSrc,
    thumbnailSrc,
    videoMetadata: metadata,
    videoError,
    isLoadingVideo,
    isGeneratingPreview,
    isUsingPreview,
    selection,
    isProcessing,
    progress,
    messages,
    isGenerating,
    outputDirectory,
    history,
    selectVideo,
    selectOutputDirectory,
    setVideoError,
    sendMessage,
    cancelProcessing,
    loadHistory,
    deleteJob,
    clearHistory,
    attachedImages,
    attachImages,
    removeAttachment,
    clearAttachments,
    pendingPreviewConfirm,
    confirmPreview,
  } = useProcessing();

  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const formatTime = (seconds: number): string => {
    if (!seconds || !Number.isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 MB';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const getDisplayTitle = (filename: string): string => {
    const dotIndex = filename.lastIndexOf('.');
    if (dotIndex <= 0) return filename;
    return filename.slice(0, dotIndex);
  };

  return (
    <TooltipProvider>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
              <Film className="h-3.5 w-3.5" />
            </div>
            <h1 className="truncate text-sm font-semibold tracking-tight">{t('processing.title')}</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)} className="gap-1.5">
              <History className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('processing.history')}</span>
              {history.length > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 text-[10px]">{history.length}</Badge>
              )}
            </Button>
            <ThemePicker />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 flex-[3] flex-col gap-3 overflow-auto p-4 sm:p-5">
            <div className="relative shrink-0">
              <VideoPlayer
                videoSrc={videoSrc}
                audioSrc={audioSrc}
                thumbnailSrc={thumbnailSrc}
                videoPath={videoPath}
                metadata={metadata}
                videoError={videoError}
                isLoadingVideo={isLoadingVideo}
                isGeneratingPreview={isGeneratingPreview}
                isUsingPreview={isUsingPreview}
                selection={selection}
                onSelectVideo={selectVideo}
                onVideoError={setVideoError}
              />
            </div>

            {metadata && (
              <Panel className="shrink-0 p-3 sm:p-3.5">
                <h2 className="line-clamp-2 text-sm font-semibold leading-snug tracking-tight">
                  {getDisplayTitle(metadata.filename)}
                </h2>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <MetaChip icon={<Clock className="h-3 w-3" />} label={formatTime(metadata.duration)} />
                  <MetaChip icon={<Maximize2 className="h-3 w-3" />} label={`${metadata.width}×${metadata.height}`} />
                  <MetaChip icon={<FileDown className="h-3 w-3" />} label={formatFileSize(metadata.file_size)} />
                  {metadata.fps > 0 && (
                    <MetaChip icon={<Zap className="h-3 w-3" />} label={`${metadata.fps.toFixed(0)} fps`} />
                  )}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/5 text-primary">
                    <Film className="h-3 w-3" />
                    {metadata.video_codec}
                  </Badge>
                  {metadata.audio_codec && (
                    <Badge variant="outline" className="gap-1">
                      <Music className="h-3 w-3" />
                      {metadata.audio_codec}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="font-mono text-[10px] uppercase">{metadata.format}</Badge>
                </div>
              </Panel>
            )}
          </div>

          <ChatPanel
            messages={messages}
            isGenerating={isGenerating}
            isProcessing={isProcessing}
            progress={progress}
            hasVideo={!!metadata && !!videoPath}
            outputDirectory={outputDirectory}
            attachedImages={attachedImages}
            onSendMessage={sendMessage}
            onSelectOutputDirectory={selectOutputDirectory}
            onCancelProcessing={cancelProcessing}
            onAttachImages={attachImages}
            onRemoveAttachment={removeAttachment}
            onClearAttachments={clearAttachments}
          />
        </div>

        <HistoryDialog open={showHistory} onOpenChange={setShowHistory} history={history} onDelete={deleteJob} onClearAll={clearHistory} />
        <PreviewConfirmDialog info={pendingPreviewConfirm} onConfirm={confirmPreview} />
      </div>
    </TooltipProvider>
  );
}

function MetaChip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground">
      {icon}
      <span className="tabular-nums text-foreground">{label}</span>
    </span>
  );
}
