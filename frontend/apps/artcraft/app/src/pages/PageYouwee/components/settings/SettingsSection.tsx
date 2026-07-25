import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SettingsSectionProps {
  id?: string;
  title: string;
  description?: string;
  icon: ReactNode;
  /** @deprecated North uses flat icon wells; ignored for visual styling */
  iconClassName?: string;
  children: ReactNode;
  className?: string;
}

export function SettingsSection({
  id,
  title,
  description,
  icon,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <section id={id} className={cn('space-y-3', className)}>
      <header className="flex items-start gap-3 border-b border-border pb-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-panel text-primary">
          {icon}
        </div>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{description}</p>
          ) : null}
        </div>
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

interface SettingsCardProps {
  id?: string;
  children: ReactNode;
  className?: string;
  highlight?: boolean;
}

export function SettingsCard({ id, children, className, highlight }: SettingsCardProps) {
  return (
    <div
      id={id}
      className={cn(
        'rounded-md border border-border bg-card p-4 shadow-none transition-[box-shadow,background-color] duration-150',
        highlight && 'ring-1 ring-primary/40 bg-primary/5',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface SettingsRowProps {
  id?: string;
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
  highlight?: boolean;
  controlClassName?: string;
}

export function SettingsRow({
  id,
  label,
  description,
  children,
  className,
  highlight,
  controlClassName,
}: SettingsRowProps) {
  return (
    <div
      id={id}
      className={cn(
        'flex flex-col items-start gap-3 rounded-md px-2 py-2.5 -mx-2 transition-[background-color,box-shadow] duration-150 md:flex-row md:items-center md:justify-between',
        highlight && 'bg-primary/5 ring-1 ring-primary/30',
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{description}</p>
        ) : null}
      </div>
      <div className={cn('w-full md:w-auto md:shrink-0', controlClassName)}>{children}</div>
    </div>
  );
}

interface SettingsDividerProps {
  className?: string;
}

export function SettingsDivider({ className }: SettingsDividerProps) {
  return <div className={cn('h-px bg-border', className)} role="separator" />;
}
