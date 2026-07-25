import { cn } from '@/lib/utils';

type PlatformTagProps = {
  platform: string;
  size?: 'sm' | 'xs';
};

export function PlatformTag({ platform, size = 'sm' }: PlatformTagProps) {
  const config: Record<string, { label: string; className: string }> = {
    youtube: {
      label: 'YouTube',
      className: 'bg-red-500/10 text-red-600 border-red-500/25 dark:text-red-400',
    },
    bilibili: {
      label: 'Bilibili',
      className: 'bg-sky-500/10 text-sky-600 border-sky-500/25 dark:text-sky-400',
    },
    youku: {
      label: 'Youku',
      className: 'bg-blue-500/10 text-blue-600 border-blue-500/25 dark:text-blue-400',
    },
  };

  const item = config[platform];
  if (!item) return null;

  const sizeClass = size === 'xs' ? 'text-[9px] px-1 py-px' : 'text-[10px] px-1.5 py-0.5';

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-sm border font-medium leading-none tracking-wide uppercase',
        sizeClass,
        item.className,
      )}
    >
      {item.label}
    </span>
  );
}
