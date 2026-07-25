import { type LucideIcon, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateIllustrationProps {
  icon?: LucideIcon;
  className?: string;
  isActive?: boolean;
  size?: 'sm' | 'md';
}

const sizeClasses = {
  sm: {
    frame: 'h-24 w-28',
    icon: 'h-4 w-4',
  },
  md: {
    frame: 'h-28 w-32',
    icon: 'h-5 w-5',
  },
};

/**
 * North empty-state mark — pure geometric SVG (no card stack / soft pastel art).
 * Keeps the EmptyStateIllustration export for existing call sites.
 */
export function EmptyStateIllustration({
  icon: Icon = Search,
  className,
  isActive = false,
  size = 'md',
}: EmptyStateIllustrationProps) {
  const classes = sizeClasses[size];

  return (
    <div
      className={cn('relative flex items-center justify-center', classes.frame, className)}
      aria-hidden
    >
      <svg viewBox="0 0 128 112" className="absolute inset-0 h-full w-full" fill="none">
        {/* Outer frame */}
        <rect
          x="12"
          y="10"
          width="104"
          height="84"
          rx="4"
          className="stroke-border"
          strokeWidth="1.5"
        />
        {/* Grid lines */}
        <line x1="12" y1="38" x2="116" y2="38" className="stroke-border" strokeWidth="1" />
        <line x1="48" y1="38" x2="48" y2="94" className="stroke-border" strokeWidth="1" />
        {/* Accent bar */}
        <rect x="12" y="10" width="6" height="84" rx="1" className="fill-primary/80" />
        {/* Geometric nodes */}
        <circle cx="72" cy="58" r="10" className="stroke-primary/50" strokeWidth="1.5" />
        <circle cx="72" cy="58" r="3" className="fill-primary" />
        <path
          d="M62 72 L72 62 L90 78"
          className="stroke-primary/40"
          strokeWidth="1.5"
          strokeLinecap="square"
        />
        {/* Baseline ticks */}
        <rect x="56" y="100" width="16" height="2" rx="1" className="fill-muted-foreground/25" />
        <rect x="48" y="104" width="32" height="2" rx="1" className="fill-muted-foreground/15" />
      </svg>

      <div
        className={cn(
          'relative z-10 flex items-center justify-center rounded-md border border-primary/30 bg-card text-primary',
          'h-9 w-9',
        )}
      >
        {isActive && (
          <span className="absolute inset-0 rounded-md border border-primary/40 animate-pulse" />
        )}
        <Icon className={classes.icon} strokeWidth={1.75} />
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  isActive?: boolean;
  size?: 'sm' | 'md';
}

/** Composed empty state with geometric illustration + copy. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  isActive,
  size = 'md',
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-6 py-10',
        className,
      )}
    >
      <EmptyStateIllustration icon={icon} isActive={isActive} size={size} className="mb-5" />
      <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
