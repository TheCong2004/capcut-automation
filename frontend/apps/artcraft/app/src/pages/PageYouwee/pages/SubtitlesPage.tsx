import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { CircleHelp, Subtitles } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ThemePicker } from '@/pages/PageYouwee/components/settings/ThemePicker';
import { FindReplacePanel } from '@/pages/PageYouwee/components/subtitles/FindReplacePanel';
import { FixErrorsDialog } from '@/pages/PageYouwee/components/subtitles/FixErrorsDialog';
import { GrammarFixDialog } from '@/pages/PageYouwee/components/subtitles/GrammarFixDialog';
import { SplitMergeDialog } from '@/pages/PageYouwee/components/subtitles/SplitMergeDialog';
import { SubtitleBatchProjectDialog } from '@/pages/PageYouwee/components/subtitles/SubtitleBatchProjectDialog';
import { SubtitleDownloadDialog } from '@/pages/PageYouwee/components/subtitles/SubtitleDownloadDialog';
import { SubtitleEditor } from '@/pages/PageYouwee/components/subtitles/SubtitleEditor';
import { SubtitleStyleProfileDialog } from '@/pages/PageYouwee/components/subtitles/SubtitleStyleProfileDialog';
import { SubtitlesEmptyState } from '@/pages/PageYouwee/components/subtitles/SubtitlesEmptyState';
import { SubtitlesUsageGuide } from '@/pages/PageYouwee/components/subtitles/SubtitlesUsageGuide';
import { SubtitlesWorkspaceStatus } from '@/pages/PageYouwee/components/subtitles/SubtitlesWorkspaceStatus';
import { SubtitleToolbar } from '@/pages/PageYouwee/components/subtitles/SubtitleToolbar';
import { SubtitleVideoPreview } from '@/pages/PageYouwee/components/subtitles/SubtitleVideoPreview';
import { TimingDialog } from '@/pages/PageYouwee/components/subtitles/TimingDialog';
import { TranslateDialog } from '@/pages/PageYouwee/components/subtitles/TranslateDialog';
import { WhisperGenerateDialog } from '@/pages/PageYouwee/components/subtitles/WhisperGenerateDialog';
import { Button } from '@/pages/PageYouwee/components/ui/button';
import { useSubtitle } from '@/pages/PageYouwee/contexts/SubtitleContext';
import { detectFormatFromFilename, parseSubtitles } from '@/pages/PageYouwee/lib/subtitle-parser';

export function SubtitlesPage() {
  const { t } = useTranslation('subtitles');
  const subtitle = useSubtitle();
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [showTimingDialog, setShowTimingDialog] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [showFixErrors, setShowFixErrors] = useState(false);
  const [showSplitMerge, setShowSplitMerge] = useState(false);
  const [showBatchProject, setShowBatchProject] = useState(false);
  const [showStyleProfiles, setShowStyleProfiles] = useState(false);
  const [showWhisper, setShowWhisper] = useState(false);
  const [showTranslate, setShowTranslate] = useState(false);
  const [showGrammarFix, setShowGrammarFix] = useState(false);
  const [showUsageGuide, setShowUsageGuide] = useState(false);

  const handleOpenFile = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Subtitle Files', extensions: ['srt', 'vtt', 'ass', 'ssa'] }],
      });
      if (!selected) return;
      const filePath = typeof selected === 'string' ? selected : selected;
      const content = await readTextFile(filePath);
      const format = detectFormatFromFilename(filePath);
      const result = parseSubtitles(content, format);
      subtitle.loadFromFile(result.entries, result.format, filePath, result.assHeader);
    } catch (err) {
      console.error('Failed to open subtitle file:', err);
    }
  }, [subtitle]);

  const handleCreateNew = useCallback(() => {
    subtitle.createNew();
  }, [subtitle]);

  const handleCloseFile = useCallback(() => {
    subtitle.closeFile();
  }, [subtitle]);

  const pageHeader = (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
          <Subtitles className="h-3.5 w-3.5" />
        </div>
        <h1 className="truncate text-sm font-semibold tracking-tight">{t('title')}</h1>
      </div>
      <ThemePicker />
    </header>
  );

  if (!subtitle.isWorkspaceOpen) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {pageHeader}
        <SubtitlesEmptyState
          onOpenFile={handleOpenFile}
          onDownloadFromUrl={() => setShowDownloadDialog(true)}
          onCreateNew={handleCreateNew}
          onGenerateWithWhisper={() => setShowWhisper(true)}
        />
        <SubtitleDownloadDialog open={showDownloadDialog} onClose={() => setShowDownloadDialog(false)} />
        <WhisperGenerateDialog open={showWhisper} onClose={() => setShowWhisper(false)} />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {pageHeader}

      <div className="shrink-0 space-y-2 border-b border-border bg-panel px-4 py-2.5 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <SubtitlesWorkspaceStatus
            fileName={subtitle.fileName}
            isDirty={subtitle.isDirty}
            entryCount={subtitle.entries.length}
            selectedCount={subtitle.selectedIds.size}
            format={subtitle.format}
          />
          <Button type="button" variant={showUsageGuide ? 'secondary' : 'outline'} size="sm" onClick={() => setShowUsageGuide((v) => !v)} className="h-8 shrink-0 gap-1.5">
            <CircleHelp className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('hints.title')}</span>
          </Button>
        </div>

        {showUsageGuide && <SubtitlesUsageGuide compact />}

        <SubtitleToolbar
          onOpenFile={handleOpenFile}
          onCreateNew={handleCreateNew}
          onCloseFile={handleCloseFile}
          onShowDownloadDialog={() => setShowDownloadDialog(true)}
          onShowBatchProject={() => setShowBatchProject(true)}
          onShowStyleProfiles={() => setShowStyleProfiles(true)}
          onShowTimingDialog={() => setShowTimingDialog(true)}
          onShowFindReplace={() => setShowFindReplace((v) => !v)}
          onShowFixErrors={() => setShowFixErrors(true)}
          onShowSplitMerge={() => setShowSplitMerge(true)}
          onShowWhisper={() => setShowWhisper(true)}
          onShowTranslate={() => setShowTranslate(true)}
          onShowGrammarFix={() => setShowGrammarFix(true)}
        />
      </div>

      {showFindReplace && (
        <div className="shrink-0 border-b border-border px-4 py-2 sm:px-5">
          <FindReplacePanel open={showFindReplace} onClose={() => setShowFindReplace(false)} />
        </div>
      )}

      <div className="min-h-0 flex-1 p-3 sm:p-4">
        <div className="flex h-full min-h-0 overflow-hidden rounded-md border border-border bg-card">
          <div className="min-h-0 min-w-0 flex-1">
            <SubtitleEditor />
          </div>
          <div className="min-h-[260px] border-t border-border lg:min-h-0 lg:w-[380px] lg:max-w-[42%] lg:border-l lg:border-t-0">
            <SubtitleVideoPreview />
          </div>
        </div>
      </div>

      <SubtitleDownloadDialog open={showDownloadDialog} onClose={() => setShowDownloadDialog(false)} />
      <TimingDialog open={showTimingDialog} onClose={() => setShowTimingDialog(false)} />
      <FixErrorsDialog open={showFixErrors} onClose={() => setShowFixErrors(false)} />
      <SplitMergeDialog open={showSplitMerge} onClose={() => setShowSplitMerge(false)} />
      <SubtitleBatchProjectDialog open={showBatchProject} onClose={() => setShowBatchProject(false)} />
      <SubtitleStyleProfileDialog open={showStyleProfiles} onClose={() => setShowStyleProfiles(false)} />
      <WhisperGenerateDialog open={showWhisper} onClose={() => setShowWhisper(false)} />
      <TranslateDialog open={showTranslate} onClose={() => setShowTranslate(false)} />
      <GrammarFixDialog open={showGrammarFix} onClose={() => setShowGrammarFix(false)} />
    </div>
  );
}
