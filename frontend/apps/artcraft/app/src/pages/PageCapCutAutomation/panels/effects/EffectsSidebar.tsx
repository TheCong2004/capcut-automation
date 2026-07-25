import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRightArrowLeft,
  faBars,
  faChevronDown,
  faLayerGroup,
  faRandom,
  faRotateLeft,
  faTrash,
  faXmark,
} from "@fortawesome/pro-solid-svg-icons";
import { twMerge } from "tailwind-merge";
import type { EffectItem, EffectsApplyMode } from "../../types";

interface EffectsSidebarProps {
  selected: EffectItem[];
  activeSelectedId: string | null;
  onSelectItem: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  applyMode: EffectsApplyMode;
  onApplyModeChange: (mode: EffectsApplyMode) => void;
  timingPlacement?: "segment_start" | "segment_full" | "entire";
  onTimingPlacementChange?: (v: "segment_start" | "segment_full" | "entire") => void;
  replaceExisting: boolean;
  onReplaceExistingChange: (v: boolean) => void;
  onApply: () => void;
}

const APPLY_MODES: {
  id: EffectsApplyMode;
  label: string;
  icon: typeof faLayerGroup;
}[] = [
  { id: "all", label: "All Effects", icon: faLayerGroup },
  { id: "alternate", label: "Alternate", icon: faArrowRightArrowLeft },
  { id: "randomize", label: "Randomize", icon: faRandom },
];

export function EffectsSidebar({
  selected,
  activeSelectedId,
  onSelectItem,
  onRemove,
  onClear,
  applyMode,
  onApplyModeChange,
  timingPlacement = "segment_start",
  onTimingPlacementChange,
  replaceExisting,
  onReplaceExistingChange,
  onApply,
}: EffectsSidebarProps) {
  const empty = selected.length === 0;

  return (
    <aside className="flex h-full min-h-0 w-full min-w-0 flex-col border-l border-white/8 bg-[#16171b]">
      {/* Selected header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="text-[14px] font-semibold text-white/90">
          Selected Effects
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
            {empty ? "empty" : selected.length}
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

      {/* Preset */}
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

      {/* Selected list */}
      <div className="min-h-[100px] max-h-[180px] overflow-y-auto border-y border-white/6 px-2 py-1">
        {empty ? (
          <div className="px-2 py-6 text-center text-[12px] text-white/30">
            No effects selected. Press + in the library.
          </div>
        ) : (
          selected.map((effect) => {
            const active = activeSelectedId === effect.id;
            return (
              <button
                key={effect.id}
                type="button"
                onClick={() => onSelectItem(effect.id)}
                className={twMerge(
                  "mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors",
                  active
                    ? "bg-white/8 text-white/80"
                    : "text-white/75 hover:bg-white/5",
                )}
              >
                <div
                  className="h-7 w-7 shrink-0 rounded border border-white/10"
                  style={{ background: effect.thumb }}
                />
                <span className="min-w-0 flex-1 truncate">{effect.name}</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(effect.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      onRemove(effect.id);
                    }
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded text-white/30 hover:bg-white/10 hover:text-white/80"
                >
                  <FontAwesomeIcon icon={faXmark} className="text-[11px]" />
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Effect settings */}
      <div className="border-b border-white/6 px-4 py-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-white/85">
            Effect Settings
          </h3>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/35 hover:bg-white/5 hover:text-white/70"
            title="Reset"
          >
            <FontAwesomeIcon icon={faRotateLeft} className="text-[12px]" />
          </button>
        </div>
        {activeSelectedId ? (
          <p className="text-[12px] text-white/50">
            Settings for{" "}
            <span className="text-white/80">
              {selected.find((e) => e.id === activeSelectedId)?.name}
            </span>{" "}
            — wire CapCut params later.
          </p>
        ) : (
          <p className="text-[12px] text-white/50">
            Select an effect in Selected Effects to adjust.
          </p>
        )}
      </div>

      {/* Apply mode */}
      <div className="space-y-4 px-4 py-4 border-t border-white/8">
        <div>
          <h3 className="mb-2 text-[13px] font-semibold text-white/85">
            Apply Mode
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {APPLY_MODES.map((mode) => {
              const active = applyMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => onApplyModeChange(mode.id)}
                  className={twMerge(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                    active
                      ? "bg-[#2a3140] text-white ring-1 ring-white/12"
                      : "bg-[#1e2026] text-white/50 hover:bg-[#252830] hover:text-white/75",
                  )}
                >
                  <FontAwesomeIcon icon={mode.icon} className="text-[10px]" />
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-[13px] font-semibold text-white/85">
            Timing placement
          </h3>
          <select
            value={timingPlacement}
            onChange={(e) =>
              onTimingPlacementChange?.(
                e.target.value as "segment_start" | "segment_full" | "entire",
              )
            }
            className="w-full rounded-lg border border-white/10 bg-[#252830] px-3 py-2 text-[12px] text-white/85 outline-none hover:border-white/20 focus:border-sky-500 cursor-pointer"
          >
            <option value="segment_start">
              📌 Đầu mỗi đoạn cắt video (3s)
            </option>
            <option value="segment_full">
              ✂️ Trọn vẹn từng đoạn cắt video
            </option>
            <option value="entire">
              🎞️ Toàn bộ video (Lặp xen kẽ 5s)
            </option>
          </select>
        </div>
      </div>

      {/* Footer actions */}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/8 px-4 py-3">
        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-white/55 select-none">
          <input
            type="checkbox"
            checked={replaceExisting}
            onChange={(e) => onReplaceExistingChange(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-white/20 bg-[#1e2026] accent-sky-500"
          />
          Replace existing effects
        </label>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onApply}
            className="rounded-lg bg-[#2b7cff] px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-[#3a88ff]"
          >
            Apply Effect
          </button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md text-white/35 hover:bg-white/5 hover:text-white/70"
            title="Expand"
          >
            <FontAwesomeIcon icon={faArrowRightArrowLeft} className="text-[11px]" />
          </button>
          <button
            type="button"
            onClick={onClear}
            className="flex h-8 w-8 items-center justify-center rounded-md text-white/35 hover:bg-white/5 hover:text-white/70"
            title="Clear"
          >
            <FontAwesomeIcon icon={faTrash} className="text-[11px]" />
          </button>
        </div>
      </div>
    </aside>
  );
}
