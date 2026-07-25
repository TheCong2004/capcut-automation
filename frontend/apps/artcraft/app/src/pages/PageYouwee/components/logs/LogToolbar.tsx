import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { Download, FileText, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { useLogs } from '@/contexts/LogContext';
import type { LogFilter } from '@/lib/types';
import { cn } from '@/lib/utils';

export function LogToolbar() {
  const { t } = useTranslation(['pages', 'common']);
  const toast = useToast();
  const {
    filter,
    search,
    loading,
    logStderr,
    setFilter,
    setSearch,
    setLogStderr,
    refreshLogs,
    clearLogs,
    exportLogs,
  } = useLogs();

  const [clearing, setClearing] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const filterOptions: { value: LogFilter; label: string }[] = [
    { value: 'all', label: t('logs.toolbar.filterAll') },
    { value: 'command', label: t('logs.toolbar.filterCommands') },
    { value: 'success', label: t('logs.toolbar.filterSuccess') },
    { value: 'info', label: t('logs.toolbar.filterInfo') },
    { value: 'error', label: t('logs.toolbar.filterErrors') },
    { value: 'stderr', label: t('logs.toolbar.filterDetail') },
  ];

  const handleClear = useCallback(() => {
    setClearConfirmOpen(true);
  }, []);

  const handleConfirmClear = useCallback(async () => {
    setClearing(true);
    try {
      await clearLogs();
      setClearConfirmOpen(false);
    } finally {
      setClearing(false);
    }
  }, [clearLogs]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const defaultFileName = `youwee-logs-${new Date().toISOString().split('T')[0]}.json`;
      const filePath = await save({
        defaultPath: defaultFileName,
        filters: [{ name: 'JSON', extensions: ['json'] }],
        title: t('logs.toolbar.exportLogs'),
      });

      if (!filePath) {
        setExporting(false);
        return;
      }

      const json = await exportLogs();
      await writeTextFile(filePath, json);

      toast.success({
        title: t('logs.toolbar.exportSuccess'),
        message: filePath,
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast.error({
        title: t('logs.toolbar.exportFailed', { error: String(error) }),
      });
    } finally {
      setExporting(false);
    }
  }, [exportLogs, t, toast]);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('logs.toolbar.searchPlaceholder')}
          className="h-9 pl-8 text-sm"
        />
      </div>

      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div className="-mx-1 overflow-x-auto px-1">
          <div
            role="tablist"
            className="inline-flex items-center gap-0.5 rounded-md border border-border bg-muted/40 p-0.5"
          >
            {filterOptions.map((option) => (
              <button
                type="button"
                role="tab"
                aria-selected={filter === option.value}
                key={option.value}
                onClick={() => setFilter(option.value)}
                className={cn(
                  'whitespace-nowrap rounded-sm px-2.5 py-1 text-xs font-medium transition-colors duration-150',
                  filter === option.value
                    ? 'bg-card text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto">
          <label className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-border bg-card px-2.5 py-1.5">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{t('logs.toolbar.logDetail')}</span>
            <Switch checked={logStderr} onCheckedChange={setLogStderr} />
          </label>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refreshLogs()}
            disabled={loading}
            className="h-8 gap-1.5"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            {t('logs.toolbar.refresh')}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
            className="h-8 gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            {t('logs.toolbar.export')}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={clearing}
            className="h-8 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t('logs.toolbar.clear')}
          </Button>
        </div>
      </div>

      <AlertDialog
        open={clearConfirmOpen}
        onOpenChange={(open) => {
          if (!clearing) {
            setClearConfirmOpen(open);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('logs.toolbar.clear')}</AlertDialogTitle>
            <AlertDialogDescription>{t('logs.toolbar.clearConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>
              {t('actions.cancel', { ns: 'common' })}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={clearing}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmClear();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('logs.toolbar.clear')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
