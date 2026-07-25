import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRightArrowLeft,
  faBars,
  faChevronDown,
  faTrash,
  faXmark,
} from "@fortawesome/pro-solid-svg-icons";
import { twMerge } from "tailwind-merge";
import type { SoundItem, SoundsPlacementRule } from "../../types";

interface SoundsSidebarProps {
  selected: SoundItem[];
  onRemove: (id: string) => void;
  onClear: () => void;
  volumeDb: number;
  onVolumeDbChange: (v: number) => void;
  fadeInSec: number;
  fadeOutSec: number;
  onFadeInChange: (v: number) => void;
  onFadeOutChange: (v: number) => void;
  placement: SoundsPlacementRule;
  onPlacementChange: (v: SoundsPlacementRule) => void;
  offsetSec: number;
  durationSec: number;
  onOffsetChange: (v: number) => void;
  onDurationChange: (v: number) => void;
  onApply: () => void;
}

const PLACEMENT_OPTIONS: { id: SoundsPlacementRule; label: string }[] = [
  { id: "start-of-each-clip", label: "Start of each clip" },
  { id: "end-of-each-clip", label: "End of each clip" },
  { id: "entire-timeline", label: "Entire timeline" },
];

export function SoundsSidebar({
  selected,
  onRemove,
  onClear,
  volumeDb,
  onVolumeDbChange,
  fadeInSec,
  fadeOutSec,
  onFadeInChange,
  onFadeOutChange,
  placement,
  onPlacementChange,
  offsetSec,
  durationSec,
  onOffsetChange,
  onDurationChange,
  onApply,
}: SoundsSidebarProps) {
  const empty = selected.length === 0;
  const placementLabel =
    PLACEMENT_OPTIONS.find((p) => p.id === placement)?.label ?? placement;

  // Map volume dB (-12..12) to slider 0..100 for UI feel
  const volumeSlider = ((volumeDb + 12) / 24) * 100;

  return (
    <aside className="flex h-full min-h-0 w-full min-w-0 flex-col border-l border-white/8 bg-[#16171b]">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[14px] font-semibold text-white/90">
            Selected Sounds
          </h2>
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
        </div>
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

      <div className="min-h-[100px] max-h-[160px] flex-1 overflow-y-auto border-b border-white/6 px-2 py-1">
        {empty ? (
          <div className="h-full min-h-[100px]" />
        ) : (
          selected.map((item) => (
            <div
              key={item.id}
              className="mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-white/75"
            >
              <div
                className="h-8 w-8 shrink-0 rounded border border-white/10"
                style={{ background: item.thumb }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate">{item.name}</div>
                <div className="font-mono text-[10px] text-white/35">
                  {item.durationLabel}
                </div>
              </div>
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

      <div className="mt-auto space-y-4 px-4 py-4">
        <div>
          <h3 className="mb-3 text-[13px] font-semibold text-white/85">
            Audio Properties
          </h3>

          <div className="mb-1 text-[11px] text-white/45">Volume</div>
          <div className="mb-3 flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              value={volumeSlider}
              onChange={(e) => {
                const slider = Number(e.target.value);
                onVolumeDbChange(Number((((slider / 100) * 24 - 12)).toFixed(1)));
              }}
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-sky-500"
            />
            <div className="flex w-[4.5rem] items-center justify-end rounded-md border border-white/10 bg-[#1e2026] px-1.5 py-1 text-[11px] text-white/70">
              {volumeDb.toFixed(1)} dB
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Fade In (s)"
              value={fadeInSec}
              onChange={onFadeInChange}
              unit="s"
            />
            <NumberField
              label="Fade Out (s)"
              value={fadeOutSec}
              onChange={onFadeOutChange}
              unit="s"
            />
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-[13px] font-semibold text-white/85">
            Placement Rule
          </h3>
          <div className="relative">
            <select
              value={placement}
              onChange={(e) =>
                onPlacementChange(e.target.value as SoundsPlacementRule)
              }
              className="w-full appearance-none rounded-lg border border-white/10 bg-[#252830] px-3 py-2 pr-8 text-[12px] text-white/80 outline-none focus:border-sky-400/40"
            >
              {PLACEMENT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <FontAwesomeIcon
              icon={faChevronDown}
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[10px] text-white/40"
            />
          </div>
          <div className="mt-1 text-[10px] text-white/25">{placementLabel}</div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Offset"
            value={offsetSec}
            onChange={onOffsetChange}
            unit="s"
          />
          <NumberField
            label="Duration"
            value={durationSec}
            onChange={onDurationChange}
            unit="s"
          />
        </div>

        <div className="flex items-center justify-end gap-1.5 pt-1">
          <button
            type="button"
            onClick={onApply}
            disabled={empty}
            className="rounded-lg bg-[#2b7cff] px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-[#3a88ff] disabled:opacity-40"
          >
            Apply Sound
          </button>
          <button
            type="button"
            disabled={empty}
            className="flex h-8 w-8 items-center justify-center rounded-md text-white/35 hover:bg-white/5 hover:text-white/70 disabled:opacity-30"
            title="Expand"
          >
            <FontAwesomeIcon
              icon={faArrowRightArrowLeft}
              className="text-[11px]"
            />
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={empty}
            className="flex h-8 w-8 items-center justify-center rounded-md text-white/35 hover:bg-white/5 hover:text-white/70 disabled:opacity-30"
            title="Clear"
          >
            <FontAwesomeIcon icon={faTrash} className="text-[11px]" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function NumberField({
  label,
  value,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-[11px] text-white/45">{label}</div>
      <div className="flex items-center rounded-lg border border-white/10 bg-[#1e2026] px-2 py-1.5">
        <input
          type="number"
          min={0}
          step={0.1}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="min-w-0 flex-1 bg-transparent text-center text-[12px] text-white outline-none"
        />
        <span className="text-[11px] text-white/40">{unit}</span>
      </div>
    </div>
  );
}
