import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * North theme transition — subtle opacity fade.
 * Keeps the MeteorTransition export + props App.tsx already wires.
 */
interface MeteorTransitionProps {
  isActive: boolean;
  oldMode: 'light' | 'dark' | null;
  onRevealStart: () => void;
  onComplete: () => void;
}

export function MeteorTransition({
  isActive,
  oldMode,
  onRevealStart,
  onComplete,
}: MeteorTransitionProps) {
  const [phase, setPhase] = useState<'idle' | 'cover' | 'reveal'>('idle');

  useEffect(() => {
    if (!isActive) {
      setPhase('idle');
      return;
    }

    setPhase('cover');

    const revealTimer = setTimeout(() => {
      onRevealStart();
      setPhase('reveal');
    }, 90);

    const completeTimer = setTimeout(() => {
      setPhase('idle');
      onComplete();
    }, 220);

    return () => {
      clearTimeout(revealTimer);
      clearTimeout(completeTimer);
    };
  }, [isActive, onRevealStart, onComplete]);

  if (!isActive && phase === 'idle') return null;

  const overlayTone =
    oldMode === 'light'
      ? 'bg-[hsl(210_16%_97%)]'
      : oldMode === 'dark'
        ? 'bg-[hsl(222_20%_6%)]'
        : 'bg-background';

  return (
    <div
      className={cn(
        'fixed inset-0 z-[9999] pointer-events-none',
        overlayTone,
        phase === 'cover' && 'opacity-100',
        phase === 'reveal' && 'opacity-0 transition-opacity duration-150 ease-out',
        phase === 'idle' && 'opacity-0',
      )}
      aria-hidden
    />
  );
}
