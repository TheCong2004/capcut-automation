import {
  AlertTriangle,
  Check,
  CheckCircle,
  Copy,
  Info,
  Lightbulb,
  Terminal,
  XCircle,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { LogEntry as LogEntryType } from '@/lib/types';
import { cn, isSafeUrl } from '@/lib/utils';

interface LogEntryProps {
  log: LogEntryType;
}

function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoString;
  }
}

type TroubleshootingKey =
  | 'ffmpegMissing'
  | 'ytdlpError'
  | 'authRequired'
  | 'privateVideo'
  | 'videoUnavailable'
  | 'rateLimit'
  | 'proxyError'
  | 'networkError'
  | 'cookieLocked'
  | 'cookieDpapi';

interface ErrorPattern {
  patterns: RegExp[];
  hint: TroubleshootingKey;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    patterns: [/ffmpeg.*not found/i, /ffprobe.*not found/i, /ffmpeg is not installed/i],
    hint: 'ffmpegMissing',
  },
  {
    patterns: [/yt-dlp.*not found/i, /yt-dlp.*error/i, /unable to extract/i],
    hint: 'ytdlpError',
  },
  {
    patterns: [/sign in to confirm/i, /403 forbidden/i, /login required/i],
    hint: 'authRequired',
  },
  {
    patterns: [/private video/i, /members.only/i, /join this channel/i],
    hint: 'privateVideo',
  },
  {
    patterns: [/video unavailable/i, /video.*removed/i, /video.*deleted/i, /not available/i],
    hint: 'videoUnavailable',
  },
  {
    patterns: [/rate.limit/i, /too many requests/i, /429/i],
    hint: 'rateLimit',
  },
  {
    patterns: [/proxy.*error/i, /proxy.*failed/i, /socks/i],
    hint: 'proxyError',
  },
  {
    patterns: [/connection.*refused/i, /network.*error/i, /timeout/i, /econnrefused/i],
    hint: 'networkError',
  },
  {
    patterns: [/failed to decrypt.*dpapi/i, /app.bound.encryption/i],
    hint: 'cookieDpapi',
  },
  {
    patterns: [
      /could not copy.*cookie/i,
      /permission denied.*cookies/i,
      /cookie.*database/i,
      /failed to.*cookie/i,
    ],
    hint: 'cookieLocked',
  },
];

function getTroubleshootingHint(message: string, details?: string): TroubleshootingKey | null {
  const fullText = `${message} ${details || ''}`.toLowerCase();

  for (const { patterns, hint } of ERROR_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(fullText)) {
        return hint;
      }
    }
  }

  return null;
}

export function LogEntry({ log }: LogEntryProps) {
  const { t } = useTranslation('pages');
  const [copied, setCopied] = useState(false);

  const troubleshootingHint = useMemo(() => {
    if (log.log_type !== 'error') return null;
    const hintKey = getTroubleshootingHint(log.message, log.details);
    if (!hintKey) return null;
    return t(`logs.troubleshooting.${hintKey}`);
  }, [log, t]);

  const logTypeConfig = {
    command: {
      icon: Terminal,
      label: t('logs.entry.command'),
      className: 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/25',
      messageClass: 'text-sky-700 dark:text-sky-300',
    },
    success: {
      icon: CheckCircle,
      label: t('logs.entry.success'),
      className: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
      messageClass: 'text-foreground',
    },
    error: {
      icon: XCircle,
      label: t('logs.entry.error'),
      className: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/25',
      messageClass: 'text-red-600 dark:text-red-400',
    },
    stderr: {
      icon: AlertTriangle,
      label: t('logs.entry.stderr'),
      className: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25',
      messageClass: 'text-amber-700 dark:text-amber-300',
    },
    info: {
      icon: Info,
      label: t('logs.entry.info'),
      className: 'text-muted-foreground bg-muted border-border',
      messageClass: 'text-foreground',
    },
  };

  const config = logTypeConfig[log.log_type] || logTypeConfig.info;
  const Icon = config.icon;

  const handleCopy = useCallback(() => {
    const textToCopy = [
      `[${log.log_type.toUpperCase()}] ${log.timestamp}`,
      log.message,
      log.details ? `Details: ${log.details}` : null,
      log.url ? `URL: ${log.url}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [log]);

  return (
    <article className="group relative min-w-0 overflow-hidden px-3 py-2.5 transition-colors duration-150 hover:bg-muted/40">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              config.className,
            )}
          >
            <Icon className="h-3 w-3" />
            {config.label}
          </span>
          <time className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatTimestamp(log.timestamp)}
          </time>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-6 gap-1 px-1.5 text-[11px] opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-500" />
              {t('logs.entry.copied')}
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              {t('logs.entry.copy')}
            </>
          )}
        </Button>
      </div>

      <div className="min-w-0 space-y-1">
        <p
          className={cn(
            'break-words font-mono text-xs leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]',
            config.messageClass,
          )}
        >
          {log.message}
        </p>

        {log.details && (
          <p className="break-words text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]">
            {log.details}
          </p>
        )}

        {log.url && (
          <p className="break-words text-[11px] whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]">
            <span className="text-muted-foreground/70">{t('logs.entry.url')}:</span>{' '}
            <a
              href={isSafeUrl(log.url) ? log.url : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="break-words text-primary hover:underline [overflow-wrap:anywhere]"
            >
              {log.url}
            </a>
          </p>
        )}

        {troubleshootingHint && (
          <div className="mt-1.5 flex items-start gap-1.5 border-t border-border pt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
            <Lightbulb className="mt-0.5 h-3 w-3 shrink-0" />
            <p>
              <span className="font-medium">{t('logs.troubleshooting.tip')}:</span>{' '}
              {troubleshootingHint}
            </p>
          </div>
        )}
      </div>
    </article>
  );
}
