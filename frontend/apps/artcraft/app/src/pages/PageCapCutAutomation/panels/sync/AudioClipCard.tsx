import { WaveformBars } from "../../shared/WaveformBars";
import type { AudioClip } from "../../types";

export function AudioClipCard({ clip }: { clip: AudioClip }) {
  return (
    <div className="flex min-w-[140px] flex-1 flex-col justify-center overflow-hidden rounded-md border border-blue-400/45 bg-blue-900/50 px-2 py-1.5">
      <div className="mb-1 truncate text-[11px] font-medium text-white">
        {clip.label}
      </div>
      <WaveformBars
        bars={Math.max(24, Math.round(clip.durationSec * 10))}
        barClassName="bg-sky-300/85"
      />
      <div className="mt-0.5 text-[10px] text-white/70">
        {clip.durationSec.toFixed(1)}s
      </div>
    </div>
  );
}
