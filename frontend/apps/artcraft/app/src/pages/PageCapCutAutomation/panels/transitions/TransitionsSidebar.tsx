import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRightArrowLeft,
  faBars,
  faChevronDown,
  faRandom,
  faTrash,
  faXmark,
} from "@fortawesome/pro-solid-svg-icons";
import { twMerge } from "tailwind-merge";
import type { TransitionItem, TransitionsAnimMode } from "../../types";

interface TransitionsSidebarProps {
  selected: TransitionItem[];
  onRemove: (id: string) => void;
  onClear: () => void;
  durationSec: number;
  onDurationChange: (v: number) => void;
  animMode: TransitionsAnimMode;
  onAnimModeChange: (mode: TransitionsAnimMode) => void;
  replaceExisting: boolean;
  onReplaceExistingChange: (v: boolean) => void;
  onApply: () => void;
}

export function TransitionsSidebar({
  selected,
  onRemove,
  onClear,
  durationSec,
  onDurationChange,
  animMode,
  onAnimModeChange,
  replaceExisting,
  onReplaceExistingChange,
  onApply,
}: TransitionsSidebarProps) {
  const empty = selected.length === 0;

  return (
    <aside className="flex h-full min-h-0 w-full min-w-0 flex-col border-l border-white/8 bg-[#16171b]">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="text-[14px] font-semibold text-white/90">
          Selected Transitions
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

      <div className="min-h-[120px] max-h-[200px] flex-1 overflow-y-auto border-y border-white/6 px-2 py-1">
        {empty ? (
          <div className="px-2 py-8 text-center text-[12px] text-white/30">
            No transitions selected. Press + in the library.
          </div>
        ) : (
          selected.map((item) => (
            <div
              key={item.id}
              className="mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-white/75"
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

      <div className="mt-auto space-y-4 px-4 py-4">
        <div>
          <div className="mb-2 text-[13px] font-semibold text-white/85">
            Duration
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0.1}
              max={3}
              step={0.1}
              value={durationSec}
              onChange={(e) => onDurationChange(Number(e.target.value))}
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-sky-500"
            />
            <div className="flex w-16 items-center justify-end rounded-md border border-white/10 bg-[#1e2026] px-1.5 py-1 text-[11px] text-white/70">
              {durationSec.toFixed(1)}s
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-[13px] font-semibold text-white/85">
            Animation Mode
          </div>
          <div className="flex flex-wrap gap-1.5">
            <ModeBtn
              active={animMode === "alternate"}
              onClick={() => onAnimModeChange("alternate")}
              icon={faArrowRightArrowLeft}
              label="Alternate"
            />
            <ModeBtn
              active={animMode === "randomize"}
              onClick={() => onAnimModeChange("randomize")}
              icon={faRandom}
              label="Randomize from selection"
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
          Replace existing transitions
        </label>

        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={onApply}
            disabled={empty}
            className="rounded-lg bg-[#2b7cff] px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-[#3a88ff] disabled:opacity-40"
          >
            Apply Transition
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

function ModeBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof faRandom;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={twMerge(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
        active
          ? "bg-[#2a3140] text-white ring-1 ring-white/12"
          : "bg-[#1e2026] text-white/50 hover:bg-[#252830] hover:text-white/75",
      )}
    >
      <FontAwesomeIcon icon={icon} className="text-[10px]" />
      {label}
    </button>
  );
}
