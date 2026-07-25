import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { twMerge } from "tailwind-merge";

type Side = "right" | "left";

interface ResizableSplitProps {
  /** Panel co giãn: right (sidebar phải) hoặc left */
  resizeSide?: Side;
  /** localStorage key lưu width */
  storageKey: string;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
  /** Cột trái (thường library / main) */
  left: ReactNode;
  /** Cột phải (thường settings / selected) */
  right: ReactNode;
}

function loadW(key: string, def: number, min: number, max: number) {
  try {
    const n = Number(localStorage.getItem(key));
    if (Number.isFinite(n)) return Math.min(max, Math.max(min, n));
  } catch {
    /* ignore */
  }
  return def;
}

/**
 * Chia 2 panel ngang + thanh kéo thu phóng (giống All Projects / CapCut Pilot).
 * Kéo mép giữa: thu/phóng cột resizeSide.
 */
export function ResizableSplit({
  resizeSide = "right",
  storageKey,
  defaultWidth = 340,
  minWidth = 240,
  maxWidth = 560,
  className,
  left,
  right,
}: ResizableSplitProps) {
  const [width, setWidth] = useState(() =>
    loadW(storageKey, defaultWidth, minWidth, maxWidth),
  );
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startW = useRef(defaultWidth);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(width));
    } catch {
      /* ignore */
    }
  }, [storageKey, width]);

  const onDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(true);
      startX.current = e.clientX;
      startW.current = width;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [width],
  );

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      // resize right: kéo trái → rộng hơn; resize left: kéo phải → rộng hơn
      const delta =
        resizeSide === "right"
          ? startX.current - e.clientX
          : e.clientX - startX.current;
      const next = Math.min(maxWidth, Math.max(minWidth, startW.current + delta));
      setWidth(next);
    },
    [dragging, maxWidth, minWidth, resizeSide],
  );

  const onUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const handle = (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Kéo để thu phóng panel"
      title="Kéo để thu / phóng panel · double-click không dùng"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      className={twMerge(
        "group relative z-20 w-1.5 shrink-0 cursor-col-resize touch-none",
        "bg-transparent hover:bg-sky-400/35",
        dragging && "bg-sky-400/50",
      )}
    >
      {/* hit area rộng hơn */}
      <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
      <div
        className={twMerge(
          "pointer-events-none absolute top-1/2 left-1/2 h-10 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/15 opacity-0 transition-opacity group-hover:opacity-100",
          dragging && "opacity-100 bg-sky-300/80",
        )}
      />
    </div>
  );

  const sideStyle = { width, minWidth: width, maxWidth: width } as const;

  return (
    <div
      className={twMerge(
        "flex min-h-0 min-w-0 flex-1",
        dragging && "select-none",
        className,
      )}
    >
      {resizeSide === "left" ? (
        <>
          <div className="flex min-h-0 shrink-0 flex-col overflow-hidden" style={sideStyle}>
            {left}
          </div>
          {handle}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {right}
          </div>
        </>
      ) : (
        <>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {left}
          </div>
          {handle}
          <div className="flex min-h-0 shrink-0 flex-col overflow-hidden" style={sideStyle}>
            {right}
          </div>
        </>
      )}
    </div>
  );
}
