import {
  AlertCircle,
  CheckCircle2,
  ClipboardPaste,
  FileCode2,
  FileJson,
  FileText,
  FolderOpen,
  Image,
  Link,
  Link2,
  List,
  Loader2,
  MessageSquare,
  Play,
  Plus,
  Square,
  Subtitles,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyStateIllustration } from '@/components/shared/EmptyStateIllustration';
import { SubtitlePopoverContent } from '@/components/shared/SubtitlePopoverContent';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useMetadata } from '@/contexts/metadata-context';
import { cn } from '@/lib/utils';

export function AssetsExportTab() {
  const { t } = useTranslation('metadata');
  const { t: tDownload } = useTranslation('download');
  const [inputText, setInputText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const {
    items,
    isFetching,
    settings,
    addUrls,
    removeItem,
    clearAll,
    clearCompleted,
    startFetch,
    stopFetch,
    selectOutputFolder,
    updateSettings,
  } = useMetadata();

  const urlCount = inputText
    .trim()
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('#') && trimmed.includes('http');
    }).length;

  const hasMultipleLines = inputText.includes('\n');
  useEffect(() => {
    if (hasMultipleLines && !isExpanded) {
      setIsExpanded(true);
    }
  }, [hasMultipleLines, isExpanded]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInputText((prev) => (prev ? `${prev}\n${text}` : text));
    } catch (error) {
      console.error('Failed to paste:', error);
    }
  };

  const handleAdd = () => {
    if (inputText.trim()) {
      addUrls(inputText);
      setInputText('');
      setIsExpanded(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      handleAdd();
    } else if (event.key === 'Enter' && !isExpanded) {
      event.preventDefault();
      handleAdd();
    }
  };

  const pendingCount = items.filter((item) => item.status === 'pending').length;
  const completedCount = items.filter((item) => item.status === 'completed').length;
  const hasItems = items.length > 0;
  const outputFolderName = settings.outputPath
    ? settings.outputPath.split('/').pop() || settings.outputPath
    : t('selectFolder');

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex-shrink-0 space-y-2.5 border-b border-border bg-panel/40 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-md border border-border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              disabled={isFetching}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                !isExpanded
                  ? 'bg-background  text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>{t('single')}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              disabled={isFetching}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                isExpanded
                  ? 'bg-background  text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <List className="w-3.5 h-3.5" />
              <span>{t('multiple')}</span>
            </button>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {isExpanded ? t('multipleHint') : t('singleHint')}
          </span>
        </div>

        {!isExpanded ? (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('assetsInputPlaceholder')}
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isFetching}
                className="pl-10 pr-20 h-11 text-sm bg-background border-border"
              />
              {urlCount > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {urlCount} URL{urlCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleAdd}
              disabled={!inputText.trim() || isFetching}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('addToQueue')}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Textarea
                placeholder={t('assetsInputPlaceholderMultiple')}
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isFetching}
                className="min-h-[100px] resize-none font-mono text-sm bg-background border-border"
              />
              {urlCount > 0 && (
                <div className="absolute bottom-2 right-2">
                  <span className="text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                    {urlCount} URL{urlCount !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleAdd}
                disabled={!inputText.trim() || isFetching}
              >
                <Plus className="w-4 h-4" />
                {t('addToQueue')} {urlCount > 0 && `(${urlCount})`}
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePaste}
                disabled={isFetching}
                className="h-8 gap-1.5 text-xs"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                {t('paste')}
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 p-3 rounded-md border border-border bg-panel">
          <button
            type="button"
            onClick={() => updateSettings({ writeInfoJson: !settings.writeInfoJson })}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all',
              settings.writeInfoJson
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'bg-background text-muted-foreground hover:text-foreground border border-transparent hover:border-border',
            )}
          >
            <FileJson className="w-3.5 h-3.5" />
            {t('infoJson')}
          </button>

          <button
            type="button"
            onClick={() => updateSettings({ writeDescription: !settings.writeDescription })}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all',
              settings.writeDescription
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'bg-background text-muted-foreground hover:text-foreground border border-transparent hover:border-border',
            )}
          >
            <FileText className="w-3.5 h-3.5" />
            {t('description')}
          </button>

          <button
            type="button"
            onClick={() => updateSettings({ writeComments: !settings.writeComments })}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all',
              settings.writeComments
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'bg-background text-muted-foreground hover:text-foreground border border-transparent hover:border-border',
            )}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {t('comments')}
          </button>

          <button
            type="button"
            onClick={() => updateSettings({ writeThumbnail: !settings.writeThumbnail })}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all',
              settings.writeThumbnail
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'bg-background text-muted-foreground hover:text-foreground border border-transparent hover:border-border',
            )}
          >
            <Image className="w-3.5 h-3.5" />
            {t('thumbnail')}
          </button>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all',
                  settings.writeSubtitles
                    ? 'bg-primary/10 text-primary border border-primary/30'
                    : 'bg-background text-muted-foreground hover:text-foreground border border-transparent hover:border-border',
                )}
              >
                <Subtitles className="w-3.5 h-3.5" />
                {t('subtitles')}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start" side="bottom" sideOffset={8}>
              <SubtitlePopoverContent
                title={t('subtitles')}
                headerAction={{
                  active: settings.writeSubtitles,
                  activeLabel: t('subtitleEnabled'),
                  inactiveLabel: t('subtitleDisabled'),
                  onToggle: () => updateSettings({ writeSubtitles: !settings.writeSubtitles }),
                }}
                showDetails={settings.writeSubtitles}
                languageLabel={t('subtitleLanguages')}
                languageCodes={[
                  'en',
                  'ar',
                  'vi',
                  'ja',
                  'ko',
                  'zh-Hans',
                  'zh-Hant',
                  'th',
                  'es',
                  'fr',
                  'de',
                  'pt',
                  'ru',
                ]}
                selectedLanguages={settings.subtitleLangs}
                onToggleLanguage={(code) => {
                  const newLangs = settings.subtitleLangs.includes(code)
                    ? settings.subtitleLangs.filter((lang) => lang !== code)
                    : [...settings.subtitleLangs, code];
                  updateSettings({ subtitleLangs: newLangs });
                }}
                getLanguageLabel={(code) => tDownload(`languages.${code}`)}
                emptyLanguageText={t('subtitleSelectLang')}
                selectedLanguagesText={t('subtitleSelectedLangs', {
                  langs: settings.subtitleLangs.join(', ').toUpperCase(),
                })}
                formatLabel={t('subtitleFormat')}
                formatValue={settings.subtitleFormat}
                formatOptions={[
                  { value: 'srt', label: 'SRT' },
                  { value: 'vtt', label: 'VTT' },
                  { value: 'ass', label: 'ASS' },
                ]}
                onFormatChange={(value) => updateSettings({ subtitleFormat: value })}
                hint={t('subtitleHint')}
              />
            </PopoverContent>
          </Popover>

          <div className="flex-1" />

          <button
            type="button"
            onClick={selectOutputFolder}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="truncate max-w-[120px]">{outputFolderName}</span>
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pt-3 sm:px-5">
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
            <EmptyStateIllustration className="mb-5" icon={FileCode2} />
            <h3 className="text-lg font-medium mb-2">{t('emptyQueue')}</h3>
            <p className="text-sm text-muted-foreground max-w-md">{t('emptyQueueHint')}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-muted-foreground">
                {t('stats', {
                  total: items.length,
                  completed: completedCount,
                  pending: pendingCount,
                })}
              </span>
              {completedCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearCompleted}>
                  {t('clearCompleted')}
                </Button>
              )}
            </div>

            <ScrollArea className="flex-1">
              <div className="space-y-2 pr-4 pb-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-md border bg-card/50 transition-colors',
                      item.status === 'completed' && 'border-green-500/30 bg-green-500/5',
                      item.status === 'error' && 'border-red-500/30 bg-red-500/5',
                      item.status === 'fetching' && 'border-primary/30 bg-primary/5',
                    )}
                  >
                    <div className="flex-shrink-0">
                      {item.status === 'pending' && (
                        <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                      )}
                      {item.status === 'fetching' && (
                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                      )}
                      {item.status === 'completed' && (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      )}
                      {item.status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      {item.error && <p className="text-xs text-red-500 truncate">{item.error}</p>}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={() => removeItem(item.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </div>

      {hasItems && (
        <footer className="flex-shrink-0 border-t border-border bg-panel px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            {!isFetching ? (
              <Button
                type="button"
                className="h-9 flex-1 gap-2"
                onClick={startFetch}
                disabled={pendingCount === 0}
              >
                <Play className="h-4 w-4" />
                <span>{t('fetchMetadata')}</span>
                {pendingCount > 0 && (
                  <span className="rounded-sm bg-primary-foreground/15 px-1.5 py-0.5 text-xs">
                    {pendingCount}
                  </span>
                )}
              </Button>
            ) : (
              <Button className="h-9 flex-1 text-sm" variant="destructive" onClick={stopFetch}>
                <Square className="mr-2 h-4 w-4" />
                {t('stop')}
              </Button>
            )}

            <Button
              variant="outline"
              size="icon"
              onClick={clearAll}
              disabled={isFetching || items.length === 0}
              className="h-9 w-9 shrink-0"
              title={t('clearAll')}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </footer>
      )}
    </div>
  );
}
