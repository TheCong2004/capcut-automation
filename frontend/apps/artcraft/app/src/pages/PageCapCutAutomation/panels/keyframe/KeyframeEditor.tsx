import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDiamond } from "@fortawesome/pro-solid-svg-icons";
import { twMerge } from "tailwind-merge";
import type { KeyframeUnit } from "../../types";

export interface KeyframeEditorState {
  templateName: string;
  unit: KeyframeUnit;
  duration: number;
  scaleW: number;
  scaleH: number;
  uniformScale: boolean;
  posX: number;
  posY: number;
  rotate: number;
}

interface KeyframeEditorProps {
  state: KeyframeEditorState;
  onChange: (patch: Partial<KeyframeEditorState>) => void;
  onSave: () => void;
}

export function KeyframeEditor({
  state,
  onChange,
  onSave,
}: KeyframeEditorProps) {
  const durationDisplay =
    state.unit === "percent"
      ? `${state.duration.toFixed(2)}%`
      : `${Math.round(state.duration)} ms`;

  const setScaleW = (v: number) => {
    if (state.uniformScale) {
      onChange({ scaleW: v, scaleH: v });
    } else {
      onChange({ scaleW: v });
    }
  };

  const setScaleH = (v: number) => {
    if (state.uniformScale) {
      onChange({ scaleW: v, scaleH: v });
    } else {
      onChange({ scaleH: v });
    }
  };

  return (
    <div className="flex min-h-0 flex-col border-t border-white/8 bg-[#16171b]">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {/* Name + unit */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={state.templateName}
            onChange={(e) => onChange({ templateName: e.target.value })}
            placeholder="Template name"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#252830] px-3 py-2 text-[12px] text-white outline-none placeholder:text-white/30 focus:border-sky-400/40"
          />
          <div className="flex rounded-lg bg-[#1e2026] p-0.5">
            {(
              [
                { id: "ms" as const, label: "ms" },
                { id: "percent" as const, label: "%" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChange({ unit: opt.id })}
                className={twMerge(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                  state.unit === opt.id
                    ? "bg-white text-[#1a1b1f]"
                    : "text-white/50 hover:text-white/80",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ruler 0–100 */}
        <div className="px-0.5 pt-1">
          <div className="relative h-6">
            <div className="absolute right-0 bottom-2 left-0 h-px bg-white/20" />
            {[0, 20, 40, 60, 80, 100].map((t) => (
              <div
                key={t}
                className="absolute bottom-0 flex flex-col items-center"
                style={{ left: `${t}%`, transform: "translateX(-50%)" }}
              >
                <div className="mb-0.5 h-2 w-px bg-white/30" />
                <span className="text-[9px] text-white/35">{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Duration */}
        <SliderField
          label="Duration"
          value={state.duration}
          min={0}
          max={state.unit === "percent" ? 100 : 5000}
          step={state.unit === "percent" ? 0.01 : 1}
          display={durationDisplay}
          onChange={(v) => onChange({ duration: v })}
        />

        {/* Scale */}
        <SliderField
          label="Scale width"
          value={state.scaleW}
          min={0}
          max={300}
          step={1}
          display={`${state.scaleW}%`}
          onChange={setScaleW}
          diamond
        />
        <SliderField
          label="Scale height"
          value={state.scaleH}
          min={0}
          max={300}
          step={1}
          display={`${state.scaleH}%`}
          onChange={setScaleH}
          diamond
        />

        <div className="flex items-center justify-between py-0.5">
          <span className="text-[12px] text-white/70">Uniform scale</span>
          <button
            type="button"
            role="switch"
            aria-checked={state.uniformScale}
            onClick={() => onChange({ uniformScale: !state.uniformScale })}
            className={twMerge(
              "relative h-5 w-9 rounded-full transition-colors",
              state.uniformScale ? "bg-white/35" : "bg-white/15",
            )}
          >
            <span
              className={twMerge(
                "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                state.uniformScale && "translate-x-4",
              )}
            />
          </button>
        </div>

        {/* Position */}
        <div>
          <div className="mb-1.5 text-[12px] text-white/55">Position</div>
          <div className="grid grid-cols-2 gap-2">
            <NumField
              label="X"
              value={state.posX}
              onChange={(v) => onChange({ posX: v })}
            />
            <NumField
              label="Y"
              value={state.posY}
              onChange={(v) => onChange({ posY: v })}
            />
          </div>
        </div>

        {/* Rotate */}
        <div>
          <div className="mb-1.5 text-[12px] text-white/55">Rotate</div>
          <div className="flex items-center gap-3">
            <div className="flex flex-1 items-center rounded-lg border border-white/10 bg-[#252830] px-3 py-2">
              <input
                type="number"
                step={0.01}
                value={state.rotate}
                onChange={(e) =>
                  onChange({ rotate: Number(e.target.value) || 0 })
                }
                className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none"
              />
              <span className="text-[11px] text-white/40">°</span>
              <FontAwesomeIcon
                icon={faDiamond}
                className="ml-2 text-[9px] text-white/30"
              />
            </div>
            <RotationDial
              degrees={state.rotate}
              onChange={(d) => onChange({ rotate: d })}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-white/8 px-4 py-3">
        <button
          type="button"
          onClick={onSave}
          className="w-full rounded-lg bg-[#2b7cff] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#3a88ff]"
        >
          Save Template
        </button>
      </div>
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
  diamond,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
  diamond?: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[12px] text-white/55">{label}</div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-sky-500"
        />
        <div className="flex w-[4.5rem] items-center justify-end gap-1 rounded-md border border-white/10 bg-[#1e2026] px-1.5 py-1 text-[11px] text-white/70">
          <span className="truncate">{display}</span>
          {diamond && (
            <FontAwesomeIcon
              icon={faDiamond}
              className="shrink-0 text-[8px] text-white/30"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function NumField({
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
      <div className="mb-1 text-[11px] text-white/40">{label}</div>
      <div className="flex items-center rounded-lg border border-white/10 bg-[#252830] px-2 py-1.5">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="min-w-0 flex-1 bg-transparent text-center text-[12px] text-white outline-none"
        />
        <FontAwesomeIcon
          icon={faDiamond}
          className="text-[8px] text-white/30"
        />
      </div>
    </div>
  );
}

function RotationDial({
  degrees,
  onChange,
}: {
  degrees: number;
  onChange: (d: number) => void;
}) {
  const angle = ((degrees % 360) + 360) % 360;
  return (
    <button
      type="button"
      title="Click to nudge rotation"
      onClick={() => onChange(Number((degrees + 15).toFixed(2)))}
      className="relative h-14 w-14 shrink-0 rounded-full border border-white/15 bg-gradient-to-b from-[#3a3d45] to-[#1e2026]"
    >
      <span className="absolute inset-2 rounded-full border border-white/10 bg-[#252830]" />
      <span
        className="absolute top-1.5 left-1/2 h-2.5 w-0.5 -translate-x-1/2 rounded-full bg-white/80"
        style={{
          transform: `translateX(-50%) rotate(${angle}deg)`,
          transformOrigin: "50% 22px",
        }}
      />
      <FontAwesomeIcon
        icon={faDiamond}
        className="absolute right-0 -bottom-0.5 text-[8px] text-white/30"
      />
    </button>
  );
}
