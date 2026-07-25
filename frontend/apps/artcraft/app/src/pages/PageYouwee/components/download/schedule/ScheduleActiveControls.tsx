import { AlarmClock, Play, Timer, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/card';
import type { ScheduleConfig } from '@/hooks/useSchedule';
import { formatTime } from '@/hooks/useSchedule';

interface ScheduleActiveControlsProps {
  schedule: ScheduleConfig | null;
  countdown: string;
  onCancel: () => void;
  onStartNow: () => void;
  ns: string;
}

export function ScheduleActiveControls({
  schedule,
  countdown,
  onCancel,
  onStartNow,
  ns,
}: ScheduleActiveControlsProps) {
  const { t } = useTranslation(ns);

  return (
    <Panel className="flex h-10 flex-1 items-center justify-between gap-2 border-primary/25 bg-primary/5 px-2 sm:px-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
          <Timer className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold tabular-nums leading-none text-primary">
            {countdown || t('schedule.title')}
          </p>
          <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
            <AlarmClock className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {t('schedule.title')} · {formatTime(schedule?.startAt ?? 0)}
            </span>
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="h-8 w-8"
          title={t('schedule.cancel')}
        >
          <X className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1.5 px-3"
          onClick={onStartNow}
          title={t('schedule.startNow')}
        >
          <Play className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('schedule.startNow')}</span>
        </Button>
      </div>
    </Panel>
  );
}
