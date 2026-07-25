import { twMerge } from "tailwind-merge";
import type { SyncCaptionSource as CaptionSource } from "../../types";

interface SyncCaptionSourceProps {
  source: CaptionSource;
  onChange: (s: CaptionSource) => void;
  srtFileName?: string | null;
  onPickSrt?: () => void;
}

export function SyncCaptionSourceCards({
  source,
  onChange,
  srtFileName,
  onPickSrt,
}: SyncCaptionSourceProps) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => onChange("in-project")}
        className={twMerge(
          "flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-[13px] transition-colors",
          source === "in-project"
            ? "border-white/18 bg-[#2a2d35] text-white"
            : "border-transparent bg-[#252830] text-white/75 hover:bg-[#2a2d35]",
        )}
      >
        <RadioDot selected={source === "in-project"} />
        From in-project captions
      </button>

      <button
        type="button"
        onClick={() => {
          onChange("external-srt");
          onPickSrt?.();
        }}
        className={twMerge(
          "flex w-full flex-col gap-1 rounded-xl border px-4 py-3.5 text-left transition-colors",
          source === "external-srt"
            ? "border-white/18 bg-[#2a2d35]"
            : "border-transparent bg-[#252830] hover:bg-[#2a2d35]",
        )}
      >
        <span className="flex items-center gap-3 text-[13px] text-white/90">
          <RadioDot selected={source === "external-srt"} />
          From external SRT file
        </span>
        <span className="pl-7 text-[12px] text-white/40">
          {srtFileName || "No file selected."}
        </span>
      </button>
    </div>
  );
}

function RadioDot({ selected }: { selected: boolean }) {
  return (
    <span
      className={twMerge(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
        selected ? "border-white/25" : "border-white/30",
      )}
    >
      {selected && <span className="h-2 w-2 rounded-full bg-white/40" />}
    </span>
  );
}
