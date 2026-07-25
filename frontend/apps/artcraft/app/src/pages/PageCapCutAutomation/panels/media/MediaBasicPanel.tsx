import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faChevronDown } from "@fortawesome/pro-solid-svg-icons";
import { twMerge } from "tailwind-merge";

export interface MediaBasicState {
  stabilize: boolean;
  stabilizeLevel: string;
  enhanceQuality: boolean;
  enhanceLevel: string;
  reduceNoise: boolean;
  noiseLevel: string;
  opticalFlow: boolean;
  frameRate: string;
  eyeContact: boolean;
}

interface MediaBasicPanelProps {
  state: MediaBasicState;
  onChange: (patch: Partial<MediaBasicState>) => void;
}

export function MediaBasicPanel({ state, onChange }: MediaBasicPanelProps) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-1 px-6 py-4">
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          className="flex flex-1 items-center justify-between rounded-lg border border-white/10 bg-[#252830] px-3 py-2.5 text-left text-[13px] text-white/55 hover:border-white/20"
        >
          <span>Choose preset...</span>
          <FontAwesomeIcon
            icon={faChevronDown}
            className="text-[10px] opacity-50"
          />
        </button>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-[#252830] text-white/50 hover:bg-[#2a2d35]"
        >
          <FontAwesomeIcon icon={faBars} />
        </button>
      </div>

      <FeatureRow
        checked={state.stabilize}
        onCheckedChange={(v) => onChange({ stabilize: v })}
        label="Stabilize"
        levelLabel="Level"
        selectValue={state.stabilizeLevel}
        selectOptions={["Minimum cut", "Normal", "Strong"]}
        onSelectChange={(v) => onChange({ stabilizeLevel: v })}
      />

      <FeatureRow
        checked={state.enhanceQuality}
        onCheckedChange={(v) => onChange({ enhanceQuality: v })}
        label="Enhance quality"
        levelLabel="Level"
        selectValue={state.enhanceLevel}
        selectOptions={["HD", "FHD", "UHD", "4K"]}
        onSelectChange={(v) => onChange({ enhanceLevel: v })}
      />

      <FeatureRow
        checked={state.reduceNoise}
        onCheckedChange={(v) => onChange({ reduceNoise: v })}
        label="Reduce image noise"
        levelLabel="Level"
        selectValue={state.noiseLevel}
        selectOptions={["Weak", "Medium", "Strong"]}
        onSelectChange={(v) => onChange({ noiseLevel: v })}
      />

      <FeatureRow
        checked={state.opticalFlow}
        onCheckedChange={(v) => onChange({ opticalFlow: v })}
        label="Optical flow"
        levelLabel="Frame rate"
        selectValue={state.frameRate}
        selectOptions={["24 fps", "30 fps", "60 fps"]}
        onSelectChange={(v) => onChange({ frameRate: v })}
      />

      <label className="flex cursor-pointer items-center gap-2.5 border-b border-white/6 py-3.5 select-none">
        <input
          type="checkbox"
          checked={state.eyeContact}
          onChange={(e) => onChange({ eyeContact: e.target.checked })}
          className="h-3.5 w-3.5 rounded border-white/20 bg-[#1e2026] accent-sky-500"
        />
        <span className="text-[13px] text-white/85">Eye contact</span>
      </label>
    </div>
  );
}

function FeatureRow({
  checked,
  onCheckedChange,
  label,
  levelLabel,
  selectValue,
  selectOptions,
  onSelectChange,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
  levelLabel: string;
  selectValue: string;
  selectOptions: string[];
  onSelectChange: (v: string) => void;
}) {
  return (
    <div className="border-b border-white/6 py-3.5">
      <label className="flex cursor-pointer items-center gap-2.5 select-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-white/20 bg-[#1e2026] accent-sky-500"
        />
        <span className="text-[13px] text-white/85">{label}</span>
      </label>
      <div
        className={twMerge(
          "mt-2.5 flex items-center gap-3 pl-6",
          !checked && "pointer-events-none opacity-40",
        )}
      >
        <span className="w-16 shrink-0 text-[12px] text-white/45">
          {levelLabel}
        </span>
        <div className="relative min-w-0 flex-1">
          <select
            value={selectValue}
            onChange={(e) => onSelectChange(e.target.value)}
            className="w-full appearance-none rounded-lg border border-white/10 bg-[#252830] px-3 py-2 pr-8 text-[12px] text-white/80 outline-none focus:border-sky-400/40"
          >
            {selectOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <FontAwesomeIcon
            icon={faChevronDown}
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[10px] text-white/40"
          />
        </div>
      </div>
    </div>
  );
}
