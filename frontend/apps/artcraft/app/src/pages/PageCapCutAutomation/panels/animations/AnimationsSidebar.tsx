import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRightArrowLeft,
  faBars,
  faChevronDown,
  faGripVertical,
  faTrash,
  faXmark,
} from "@fortawesome/pro-solid-svg-icons";
import { twMerge } from "tailwind-merge";
import type {
  AnimationItem,
  AnimationsDurationUnit,
  AnimationsTargetScope,
} from "../../types";

interface AnimationsSidebarProps {
  selected: AnimationItem[];
  onRemove: (id: string) => void;
  onClear: () => void;
  durationUnit: AnimationsDurationUnit;
  onDurationUnitChange: (u: AnimationsDurationUnit) => void;
  inDuration: number;
  outDuration: number;
  onInDurationChange: (v: number) => void;
  onOutDurationChange: (v: number) => void;
  comboStart: number;
  comboEnd: number;
  onComboStartChange: (v: number) => void;
  onComboEndChange: (v: number) => void;
  targetScope: AnimationsTargetScope;
  onTargetScopeChange: (s: AnimationsTargetScope) => void;
  replaceExisting: boolean;
  onReplaceExistingChange: (v: boolean) => void;
  onApply: () => void;
}

export function AnimationsSidebar({
  selected,
  onRemove,
  onClear,
  durationUnit,
  onDurationUnitChange,
  inDuration,
  outDuration,
  onInDurationChange,
  onOutDurationChange,
  comboStart,
  comboEnd,
  onComboStartChange,
  onComboEndChange,
  targetScope,
  onTargetScopeChange,
  replaceExisting,
  onReplaceExistingChange,
  onApply,
}: AnimationsSidebarProps) {
  const empty = selected.length === 0;
  const unitSuffix = durationUnit === "seconds" ? "s" : "%";

  return (
    <aside className="flex h-full min-h-0 w-full min-w-0 flex-col border-l border-white/8 bg-[#16171b]">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="text-[14px] font-semibold text-white/90">
          Selected Animations
        </h2>
        <div className="flex items-center gap-1.5">
          <span
            className={twMerge(
              "rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide",
              empty
                ? "bg-white/10 text-white/40 uppercase"
                : "bg-sky-500 text-white",
            )}
          >
            {empty ? "Empty" : `${selected.length} Active`}
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

      {/* Selected cards */}
      <div className="max-h-[160px] min-h-[72px] space-y-1.5 overflow-y-auto px-3 pb-3">
        {empty ? (
          <div className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-[12px] text-white/25">
            Add animations with +
          </div>
        ) : (
          selected.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded-lg bg-[#1e222b] px-2 py-2 ring-1 ring-white/8"
            >
              <FontAwesomeIcon
                icon={faGripVertical}
                className="text-[10px] text-white/25"
              />
              <div
                className="h-9 w-9 shrink-0 overflow-hidden rounded border border-white/10"
                style={{ background: item.thumb }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-white/90">
                  {item.name}
                </div>
                <div className="text-[10px] font-semibold tracking-wide text-white/40 uppercase">
                  {item.category}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-white/30 hover:bg-white/10 hover:text-white/80"
              >
                <FontAwesomeIcon icon={faXmark} className="text-[11px]" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="mt-auto space-y-4 border-t border-white/8 px-4 py-4">
        {/* Timing & Duration */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold text-white/85">
              Timing & Duration
            </h3>
            <div className="flex rounded-lg bg-[#1e2026] p-0.5">
              {(
                [
                  { id: "seconds" as const, label: "Seconds" },
                  { id: "percentage" as const, label: "Percentage" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onDurationUnitChange(opt.id)}
                  className={twMerge(
                    "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                    durationUnit === opt.id
                      ? "bg-white text-[#1a1b1f]"
                      : "text-white/50 hover:text-white/80",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="In Duration"
              value={inDuration}
              unit={unitSuffix}
              onChange={onInDurationChange}
            />
            <NumberField
              label="Out Duration"
              value={outDuration}
              unit={unitSuffix}
              onChange={onOutDurationChange}
            />
          </div>

          <div className="mt-3">
            <div className="mb-2 text-center text-[11px] font-medium text-white/45">
              Combo Range
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="Start at"
                value={comboStart}
                unit={unitSuffix}
                onChange={onComboStartChange}
              />
              <NumberField
                label="End at"
                value={comboEnd}
                unit={unitSuffix}
                onChange={onComboEndChange}
              />
            </div>
          </div>
        </div>

        {/* Target Scope */}
        <div>
          <h3 className="mb-2 text-[13px] font-semibold text-white/85">
            Target Scope
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <ScopeBtn
              active={targetScope === "all-clips"}
              label="All Clips"
              onClick={() => onTargetScopeChange("all-clips")}
            />
            <ScopeBtn
              active={targetScope === "first-clip"}
              label="First Clip"
              onClick={() => onTargetScopeChange("first-clip")}
            />
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-white/55 select-none">
          <input
            type="checkbox"
            checked={replaceExisting}
            onChange={(e) => onReplaceExistingChange(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-white/20 bg-[#1e2026] accent-sky-500"
          />
          Replace existing animations (same type)
        </label>

        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={onApply}
            disabled={empty}
            className="rounded-lg bg-[#2b7cff] px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-[#3a88ff] disabled:opacity-40"
          >
            Apply Animation
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
      <div className="mb-1 text-center text-[11px] text-white/45">{label}</div>
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

function ScopeBtn({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={twMerge(
        "rounded-lg px-3 py-2 text-[12px] font-medium transition-colors",
        active
          ? "bg-[#2a3140] text-white ring-1 ring-white/12"
          : "bg-[#1e2026] text-white/50 hover:bg-[#252830] hover:text-white/75",
      )}
    >
      {label}
    </button>
  );
}
