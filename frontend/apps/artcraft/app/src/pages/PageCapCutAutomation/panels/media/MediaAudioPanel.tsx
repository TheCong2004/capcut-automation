import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faChevronDown } from "@fortawesome/pro-solid-svg-icons";
import { twMerge } from "tailwind-merge";

export type MediaAudioSubTab = "basic" | "voice-changer";

export interface MediaAudioState {
  // Basic section master toggle
  basicEnabled: boolean;
  volumeDb: number;
  fadeInSec: number;
  fadeOutSec: number;
  normalize: boolean;
  enhanceVoice: boolean;
  enhanceIntensity: number;
  reduceNoise: boolean;
  isolateNoise: boolean;
  isolateMode: string;
  fillChannel: boolean;
  fillMode: string;
  // Voice changer (placeholder section)
  voiceChangerEnabled: boolean;
  voicePreset: string;
  pitch: number;
}

interface MediaAudioPanelProps {
  subTab: MediaAudioSubTab;
  state: MediaAudioState;
  onChange: (patch: Partial<MediaAudioState>) => void;
}

export function MediaAudioPanel({
  subTab,
  state,
  onChange,
}: MediaAudioPanelProps) {
  if (subTab === "voice-changer") {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 px-6 py-4">
        <PresetRow />
        <label className="flex cursor-pointer items-center gap-2.5 select-none">
          <input
            type="checkbox"
            checked={state.voiceChangerEnabled}
            onChange={(e) =>
              onChange({ voiceChangerEnabled: e.target.checked })
            }
            className="h-3.5 w-3.5 rounded border-white/20 bg-[#1e2026] accent-sky-500"
          />
          <span className="text-[13px] text-white/85">Enable voice changer</span>
        </label>
        <div
          className={twMerge(
            "space-y-3 border-t border-white/6 pt-3",
            !state.voiceChangerEnabled && "pointer-events-none opacity-40",
          )}
        >
          <div>
            <div className="mb-1.5 text-[12px] text-white/50">Voice preset</div>
            <select
              value={state.voicePreset}
              onChange={(e) => onChange({ voicePreset: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#252830] px-3 py-2 text-[12px] text-white/80 outline-none"
            >
              {[
                "None",
                "Male",
                "Female",
                "Child",
                "Robot",
                "Chipmunk",
                "Deep",
              ].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <SliderRow
            label="Pitch"
            value={state.pitch}
            min={-12}
            max={12}
            step={1}
            display={`${state.pitch > 0 ? "+" : ""}${state.pitch}`}
            onChange={(v) => onChange({ pitch: v })}
          />
        </div>
        <p className="text-[11px] text-white/30">
          Voice changer: BE local chưa có API — chỉ volume/fade ở tab Basic Apply.
        </p>
      </div>
    );
  }

  // Basic tab — matches CapCut Pilot Media → Audio → Basic
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-4">
      <div className="mb-4">
        <PresetRow />
      </div>

      {/* Basic group */}
      <section className="border-b border-white/6 pb-4">
        <CheckLabel
          checked={state.basicEnabled}
          onChange={(v) => onChange({ basicEnabled: v })}
          label="Basic"
        />
        <div
          className={twMerge(
            "mt-3 space-y-4 pl-6",
            !state.basicEnabled && "pointer-events-none opacity-40",
          )}
        >
          <SliderRow
            label="Volume"
            value={state.volumeDb}
            min={-24}
            max={12}
            step={0.1}
            display={`${state.volumeDb.toFixed(1)} dB`}
            onChange={(v) => onChange({ volumeDb: v })}
          />
          <SliderRow
            label="Fade in"
            value={state.fadeInSec}
            min={0}
            max={10}
            step={0.1}
            display={`${state.fadeInSec.toFixed(1)}s`}
            onChange={(v) => onChange({ fadeInSec: v })}
          />
          <SliderRow
            label="Fade out"
            value={state.fadeOutSec}
            min={0}
            max={10}
            step={0.1}
            display={`${state.fadeOutSec.toFixed(1)}s`}
            onChange={(v) => onChange({ fadeOutSec: v })}
          />
        </div>
      </section>

      {/* Normalize */}
      <section className="border-b border-white/6 py-3.5">
        <CheckLabel
          checked={state.normalize}
          onChange={(v) => onChange({ normalize: v })}
          label="Normalize loudness"
        />
        <p className="mt-1.5 pl-6 text-[12px] text-white/40">
          Normalize the loudness of selected clips to a target level.
        </p>
      </section>

      {/* Enhance voice */}
      <section className="border-b border-white/6 py-3.5">
        <CheckLabel
          checked={state.enhanceVoice}
          onChange={(v) => onChange({ enhanceVoice: v })}
          label="Enhance voice"
        />
        <div
          className={twMerge(
            "mt-3 pl-6",
            !state.enhanceVoice && "pointer-events-none opacity-40",
          )}
        >
          <SliderRow
            label="Intensity"
            value={state.enhanceIntensity}
            min={0}
            max={100}
            step={1}
            display={String(state.enhanceIntensity)}
            onChange={(v) => onChange({ enhanceIntensity: v })}
            showTicks
          />
        </div>
      </section>

      {/* Reduce noise */}
      <section className="border-b border-white/6 py-3.5">
        <CheckLabel
          checked={state.reduceNoise}
          onChange={(v) => onChange({ reduceNoise: v })}
          label="Reduce noise"
        />
      </section>

      {/* Isolate noise */}
      <section className="border-b border-white/6 py-3.5">
        <CheckLabel
          checked={state.isolateNoise}
          onChange={(v) => onChange({ isolateNoise: v })}
          label="Isolate noise"
        />
        <div
          className={twMerge(
            "mt-2.5 flex items-center gap-3 pl-6",
            !state.isolateNoise && "pointer-events-none opacity-40",
          )}
        >
          <span className="w-12 shrink-0 text-[12px] text-white/45">Mode</span>
          <div className="relative min-w-0 flex-1">
            <select
              value={state.isolateMode}
              onChange={(e) => onChange({ isolateMode: e.target.value })}
              className="w-full appearance-none rounded-lg border border-white/10 bg-[#252830] px-3 py-2 pr-8 text-[12px] text-white/80 outline-none focus:border-sky-400/40"
            >
              {["Keep vocal", "Keep music", "Keep ambient"].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
            <FontAwesomeIcon
              icon={faChevronDown}
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[10px] text-white/40"
            />
          </div>
        </div>
      </section>

      {/* Fill channel */}
      <section className="py-3.5">
        <CheckLabel
          checked={state.fillChannel}
          onChange={(v) => onChange({ fillChannel: v })}
          label="Fill channel"
        />
        <div
          className={twMerge(
            "mt-2.5 flex items-center gap-3 pl-6",
            !state.fillChannel && "pointer-events-none opacity-40",
          )}
        >
          <span className="w-12 shrink-0 text-[12px] text-white/45">Mode</span>
          <div className="relative min-w-0 flex-1">
            <select
              value={state.fillMode}
              onChange={(e) => onChange({ fillMode: e.target.value })}
              className="w-full appearance-none rounded-lg border border-white/10 bg-[#252830] px-3 py-2 pr-8 text-[12px] text-white/80 outline-none focus:border-sky-400/40"
            >
              {["None", "Left to mono", "Right to mono", "Stereo widen"].map(
                (o) => (
                  <option key={o}>{o}</option>
                ),
              )}
            </select>
            <FontAwesomeIcon
              icon={faChevronDown}
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[10px] text-white/40"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function PresetRow() {
  return (
    <div className="flex items-center gap-2">
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
  );
}

function CheckLabel({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-white/20 bg-[#1e2026] accent-sky-500"
      />
      <span className="text-[13px] text-white/85">{label}</span>
    </label>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
  showTicks,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
  showTicks?: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[12px] text-white/55">{label}</div>
      <div className="flex items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="relative z-[1] h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-sky-500"
          />
          {showTicks && (
            <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-0.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="h-2 w-px bg-white/25"
                />
              ))}
            </div>
          )}
        </div>
        <div className="w-[4.25rem] shrink-0 rounded-md border border-white/10 bg-[#1e2026] px-1.5 py-1.5 text-center text-[11px] text-white/70">
          {display}
        </div>
      </div>
    </div>
  );
}
