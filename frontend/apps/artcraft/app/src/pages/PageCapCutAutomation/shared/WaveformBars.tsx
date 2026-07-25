import { useMemo } from "react";

interface WaveformBarsProps {
  bars?: number;
  className?: string;
  barClassName?: string;
}

export function WaveformBars({
  bars = 48,
  className = "",
  barClassName = "bg-sky-300/80",
}: WaveformBarsProps) {
  const heights = useMemo(
    () =>
      Array.from({ length: bars }, (_, i) => {
        const t = i / bars;
        return 20 + Math.abs(Math.sin(t * 18) * 55) + (i % 5) * 4;
      }),
    [bars],
  );

  return (
    <div
      className={`flex h-7 flex-1 items-end gap-px overflow-hidden px-1 opacity-90 ${className}`}
    >
      {heights.map((h, i) => (
        <div
          key={i}
          className={`min-w-[2px] flex-1 rounded-sm ${barClassName}`}
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}
