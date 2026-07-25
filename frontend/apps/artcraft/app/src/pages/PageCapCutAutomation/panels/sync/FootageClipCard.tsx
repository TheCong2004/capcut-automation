import type { FootageClip } from "../../types";

export function FootageClipCard({ clip }: { clip: FootageClip }) {
  return (
    <div className="flex min-w-[140px] flex-1 flex-col overflow-hidden rounded-md border border-teal-400/45 bg-teal-900/45">
      <div className="truncate bg-teal-700/55 px-2 py-0.5 text-[11px] font-medium text-white">
        {clip.label}
      </div>
      <div className="flex h-10">
        {clip.swatches.map((color, i) => (
          <div
            key={i}
            className="h-full flex-1"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <div className="px-2 py-0.5 text-[10px] text-white/70">
        {clip.durationSec.toFixed(1)}s
      </div>
    </div>
  );
}
