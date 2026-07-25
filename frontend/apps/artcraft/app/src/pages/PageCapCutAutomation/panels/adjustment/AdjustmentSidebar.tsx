import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faChevronDown,
  faTrash,
  faXmark,
} from "@fortawesome/pro-solid-svg-icons";
import { twMerge } from "tailwind-merge";
import type { AdjustmentSliders, LutItem } from "../../types";

interface AdjustmentSidebarProps {
  selected: LutItem[];
  onRemove: (id: string) => void;
  onClear: () => void;
  sliders: AdjustmentSliders;
  onSliderChange: (key: keyof AdjustmentSliders, value: number) => void;
  replaceExisting: boolean;
  onReplaceExistingChange: (v: boolean) => void;
  onApply: () => void;
}

const SLIDER_ROWS: { key: keyof AdjustmentSliders; label: string }[] = [
  { key: "sharpen", label: "Sharpen" },
  { key: "clarity", label: "Clarity" },
  { key: "particles", label: "Particles" },
  { key: "fade", label: "Fade" },
  { key: "vignette", label: "Vignette" },
];

export function AdjustmentSidebar({
  selected,
  onRemove,
  onClear,
  sliders,
  onSliderChange,
  replaceExisting,
  onReplaceExistingChange,
  onApply,
}: AdjustmentSidebarProps) {
  const empty = selected.length === 0;

  return (
    <aside className="flex h-full min-h-0 w-full min-w-0 flex-col border-l border-white/8 bg-[#16171b]">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="text-[14px] font-semibold text-white/90">
          Selected LUTs
        </h2>
        <div className="flex items-center gap-1.5">
          <span
            className={twMerge(
              "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              empty
                ? "bg-white/10 text-white/40"
                : "bg-white/10 text-white/80",
            )}
          >
            {empty ? "Empty" : selected.length}
          </span>
          <button
            type="button"
            onClick={onClear}
            disabled={empty}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-white/45 hover:bg-white/5 hover:text-white/80 disabled:opacity-30"
          >
            <FontAwesomeIcon icon={faTrash} className="text-[10px]" />
            clean
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 pb-3">
        <button
          type="button"
          className="flex flex-1 items-center justify-between rounded-lg border border-white/10 bg-[#252830] px-3 py-2 text-left text-[12px] text-white/55 hover:border-white/20"
        >
          <span>Choose preset...</span>
          <FontAwesomeIcon
            icon={faChevronDown}
            className="text-[10px] opacity-50"
          />
        </button>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#252830] text-white/50 hover:bg-[#2a2d35]"
        >
          <FontAwesomeIcon icon={faBars} />
        </button>
      </div>

      <div className="min-h-[80px] max-h-[120px] overflow-y-auto border-b border-white/6 px-2 py-1">
        {empty ? (
          <div className="h-full min-h-[80px]" />
        ) : (
          selected.map((item) => (
            <div
              key={item.id}
              className="mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-white/75"
            >
              <div
                className="h-7 w-7 shrink-0 rounded border border-white/10"
                style={{ background: item.thumb }}
              />
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="flex h-6 w-6 items-center justify-center rounded text-white/30 hover:bg-white/10 hover:text-white/80"
              >
                <FontAwesomeIcon icon={faXmark} className="text-[11px]" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="mt-auto space-y-3 px-4 py-4">
        {SLIDER_ROWS.map((row) => (
          <SliderRow
            key={row.key}
            label={row.label}
            value={sliders[row.key]}
            onChange={(v) => onSliderChange(row.key, v)}
          />
        ))}

        <label className="flex cursor-pointer items-start gap-2 pt-2 text-[12px] text-white/55 select-none">
          <input
            type="checkbox"
            checked={replaceExisting}
            onChange={(e) => onReplaceExistingChange(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 rounded border-white/20 bg-[#1e2026] accent-sky-500"
          />
          <span>
            Replace existing adjustments
            <span className="mt-1 block text-[11px] text-white/30">
              Without LUT, adjust settings apply to the full project.
            </span>
          </span>
        </label>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onApply}
            className="rounded-lg bg-[#2b7cff] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#3a88ff]"
          >
            Apply Adjustment
          </button>
        </div>
      </div>
    </aside>
  );
}

function SliderRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[12px] text-white/70">{label}</div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={-100}
          max={100}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-sky-500"
        />
        <div className="flex w-14 items-center justify-center rounded-md border border-white/10 bg-[#1e2026] px-1 py-1">
          <input
            type="number"
            min={-100}
            max={100}
            value={value}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isNaN(n)) return;
              onChange(Math.max(-100, Math.min(100, n)));
            }}
            className="w-full bg-transparent text-center text-[11px] text-white/70 outline-none"
          />
        </div>
      </div>
    </div>
  );
}
