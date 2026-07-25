import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faChevronDown,
  faEye,
  faTrash,
  faXmark,
} from "@fortawesome/pro-solid-svg-icons";
import { twMerge } from "tailwind-merge";
import type { KeyframeApplyMode, KeyframeTemplate } from "../../types";

interface KeyframeSidebarProps {
  selected: KeyframeTemplate[];
  onRemove: (id: string) => void;
  onClear: () => void;
  applyMode: KeyframeApplyMode;
  onApplyModeChange: (m: KeyframeApplyMode) => void;
  customRange: string;
  onCustomRangeChange: (v: string) => void;
  applyOrder: string;
  onApplyOrderChange: (v: string) => void;
  timelineUnit: string;
  onTimelineUnitChange: (v: string) => void;
  templateLonger: string;
  onTemplateLongerChange: (v: string) => void;
  clipLonger: string;
  onClipLongerChange: (v: string) => void;
  offsetStart: number;
  onOffsetStartChange: (v: number) => void;
  onApply: () => void;
}

export function KeyframeSidebar({
  selected,
  onRemove,
  onClear,
  applyMode,
  onApplyModeChange,
  customRange,
  onCustomRangeChange,
  applyOrder,
  onApplyOrderChange,
  timelineUnit,
  onTimelineUnitChange,
  templateLonger,
  onTemplateLongerChange,
  clipLonger,
  onClipLongerChange,
  offsetStart,
  onOffsetStartChange,
  onApply,
}: KeyframeSidebarProps) {
  const empty = selected.length === 0;

  return (
    <aside className="flex h-full min-h-0 w-full min-w-0 flex-col border-l border-white/8 bg-[#16171b]">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="text-[14px] font-semibold text-white/90">
          Selected Templates
        </h2>
        <div className="flex items-center gap-1.5">
          <span
            className={twMerge(
              "rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide",
              empty
                ? "bg-white/10 text-white/40"
                : "bg-sky-500 text-white",
            )}
          >
            {empty ? "0 Active" : `${selected.length} Active`}
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
          className="flex flex-1 items-center justify-between rounded-lg border border-white/10 bg-[#252830] px-3 py-2 text-left text-[12px] text-white/55"
        >
          <span>Choose preset...</span>
          <FontAwesomeIcon
            icon={faChevronDown}
            className="text-[10px] opacity-50"
          />
        </button>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#252830] text-white/50"
        >
          <FontAwesomeIcon icon={faBars} />
        </button>
      </div>

      <div className="min-h-[80px] max-h-[140px] overflow-y-auto border-b border-white/6 px-2 py-1">
        {empty ? (
          <div className="h-full min-h-[80px]" />
        ) : (
          selected.map((t) => (
            <div
              key={t.id}
              className="mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-white/75"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-white/10 text-[9px] font-bold text-white/80">
                KF
              </div>
              <span className="min-w-0 flex-1 truncate">{t.name}</span>
              <button
                type="button"
                onClick={() => onRemove(t.id)}
                className="flex h-6 w-6 items-center justify-center rounded text-white/30 hover:bg-white/10 hover:text-white/80"
              >
                <FontAwesomeIcon icon={faXmark} className="text-[11px]" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="mt-auto space-y-4 px-4 py-4">
        {/* Apply mode */}
        <div>
          <h3 className="mb-2 text-[13px] font-semibold text-white/85">
            Apply mode
          </h3>
          <label className="mb-2 flex cursor-pointer items-center gap-2.5 select-none">
            <input
              type="radio"
              name="kf-apply-mode"
              checked={applyMode === "all"}
              onChange={() => onApplyModeChange("all")}
              className="accent-sky-500"
            />
            <span className="text-[13px] text-white/80">All</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 select-none">
            <input
              type="radio"
              name="kf-apply-mode"
              checked={applyMode === "custom"}
              onChange={() => onApplyModeChange("custom")}
              className="accent-sky-500"
            />
            <div className="relative min-w-0 flex-1">
              <input
                type="text"
                value={customRange}
                disabled={applyMode !== "custom"}
                onChange={(e) => onCustomRangeChange(e.target.value)}
                placeholder="e.g. 1-5, 8, 11-13"
                className={twMerge(
                  "w-full rounded-lg border border-white/10 bg-[#252830] py-1.5 pr-8 pl-3 text-[12px] text-white outline-none placeholder:text-white/30",
                  applyMode !== "custom" && "opacity-50",
                )}
              />
              <FontAwesomeIcon
                icon={faEye}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-[11px] text-white/30"
              />
            </div>
          </label>
        </div>

        {/* Apply order / Timeline unit */}
        <div className="grid grid-cols-2 gap-2">
          <SelectField
            label="Apply order"
            value={applyOrder}
            options={["Alternate", "Sequential", "Random"]}
            onChange={onApplyOrderChange}
          />
          <SelectField
            label="Timeline unit"
            value={timelineUnit}
            options={["Use template", "Milliseconds", "Percentage"]}
            onChange={onTimelineUnitChange}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <SelectField
            label="Template longer than"
            value={templateLonger}
            options={["Scale to fit", "Trim", "Loop"]}
            onChange={onTemplateLongerChange}
          />
          <SelectField
            label="Clip longer than temp"
            value={clipLonger}
            options={["No stretch", "Stretch", "Pad"]}
            onChange={onClipLongerChange}
          />
        </div>

        <div>
          <div className="mb-1.5 text-[12px] text-white/55">Offset start</div>
          <div className="flex items-center rounded-lg border border-white/10 bg-[#252830] px-3 py-2">
            <input
              type="number"
              min={0}
              value={offsetStart}
              onChange={(e) =>
                onOffsetStartChange(Math.max(0, Number(e.target.value) || 0))
              }
              className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none"
            />
            <span className="text-[11px] text-white/40">ms</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-1.5 pt-1">
          <button
            type="button"
            onClick={onApply}
            disabled={empty}
            className="rounded-lg bg-[#2b7cff] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#3a88ff] disabled:opacity-40"
          >
            Apply Keyframe
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

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="mb-1 truncate text-[11px] text-white/45" title={label}>
        {label}
      </div>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none truncate rounded-lg border border-white/10 bg-[#252830] px-2.5 py-2 pr-7 text-[11px] text-white/80 outline-none"
        >
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <FontAwesomeIcon
          icon={faChevronDown}
          className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[9px] text-white/40"
        />
      </div>
    </div>
  );
}
