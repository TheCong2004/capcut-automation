import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faFilm,
  faPlus,
  faVolumeHigh,
} from "@fortawesome/pro-solid-svg-icons";
import { twMerge } from "tailwind-merge";
import toast from "react-hot-toast";
import type {
  MediaKindTab,
  MediaMaskLayer,
  MediaVideoSubTab,
} from "../../types";
import {
  MediaAudioPanel,
  type MediaAudioState,
  type MediaAudioSubTab,
} from "./MediaAudioPanel";
import {
  MediaBasicPanel,
  type MediaBasicState,
} from "./MediaBasicPanel";
import {
  MediaMaskPanel,
  type MediaMaskState,
} from "./MediaMaskPanel";
import { useCapCutMate } from "../../api/CapCutMateContext";
import * as local from "../../api/capcutLocalClient";
import {
  dbToLinear,
  listSegmentIds,
  requireLocalProject,
  secToUs,
} from "../../api/localApplyHelpers";
import { PanelGuide } from "../../shared/PanelGuide";
import { PanelStatusAside } from "../../shared/PanelStatusAside";
import { ResizableSplit } from "../../shared/ResizableSplit";

const DEFAULT_BASIC: MediaBasicState = {
  stabilize: true,
  stabilizeLevel: "Minimum cut",
  enhanceQuality: true,
  enhanceLevel: "UHD",
  reduceNoise: true,
  noiseLevel: "Weak",
  opticalFlow: true,
  frameRate: "30 fps",
  eyeContact: true,
};

const DEFAULT_AUDIO: MediaAudioState = {
  basicEnabled: false,
  volumeDb: 0,
  fadeInSec: 0,
  fadeOutSec: 0,
  normalize: false,
  enhanceVoice: false,
  enhanceIntensity: 75,
  reduceNoise: false,
  isolateNoise: false,
  isolateMode: "Keep vocal",
  fillChannel: false,
  fillMode: "None",
  voiceChangerEnabled: false,
  voicePreset: "None",
  pitch: 0,
};

const DEFAULT_MASK_LAYER: MediaMaskLayer = {
  id: "mask-1",
  name: "Mask1 Filmstrip",
  type: "filmstrip",
};

const DEFAULT_MASK: MediaMaskState = {
  layers: [DEFAULT_MASK_LAYER],
  activeLayerId: DEFAULT_MASK_LAYER.id,
  maskType: "filmstrip",
  reverseMask: false,
  posX: 10,
  posY: 29,
  rotation: -340,
  size: 27,
  feather: 35,
  frameRatio: "16:9",
  zoom: 100,
};

/** Map UI mask type → local mask name (best-effort). */
function maskNameForApi(type: string): string {
  const map: Record<string, string> = {
    circle: "圆形",
    rectangle: "线性",
    split: "镜面",
    filmstrip: "镜面",
    stars: "星形",
    heart: "爱心",
    text: "文字",
    pen: "手绘",
  };
  return map[type] || type;
}

export function MediaPanel() {
  const mate = useCapCutMate();
  const [kind, setKind] = useState<MediaKindTab>("video");
  const [videoSub, setVideoSub] = useState<MediaVideoSubTab>("basic");
  const [audioSub, setAudioSub] = useState<MediaAudioSubTab>("basic");
  const [basic, setBasic] = useState<MediaBasicState>(DEFAULT_BASIC);
  const [audio, setAudio] = useState<MediaAudioState>(DEFAULT_AUDIO);
  const [mask, setMask] = useState<MediaMaskState>(DEFAULT_MASK);
  const [track, setTrack] = useState("All");
  const [mediaType, setMediaType] = useState("Audio segments");
  const [applying, setApplying] = useState(false);

  const trackOptions =
    kind === "video"
      ? ["All", "Video Track 1", "Video Track 2", "Video Track 3"]
      : ["All", "Audio Track 1", "Audio Track 2"];

  const handleApply = async () => {
    setApplying(true);
    try {
      const project = requireLocalProject(mate.localProject);

      if (kind === "audio") {
        const ids = await listSegmentIds(project, "audio");
        if (!ids.length) {
          toast.error("Không có segment audio trên draft local");
          return;
        }
        const vol = dbToLinear(audio.volumeDb);
        let n = 0;
        for (const sid of ids) {
          await local.localVolume(project, sid, vol);
          if (audio.fadeInSec > 0 || audio.fadeOutSec > 0) {
            await local.localAudioFade(project, sid, {
              fade_in_us: secToUs(audio.fadeInSec),
              fade_out_us: secToUs(audio.fadeOutSec),
            });
          }
          n += 1;
          if (track !== "All") break;
        }
        toast.success(
          `Đã set volume/fade ${n} audio segment · ${mediaType} (local)`,
        );
        if (audioSub === "voice-changer" && audio.voiceChangerEnabled) {
          toast(
            "Voice changer preset chưa có API pure Python — chỉ volume/fade được ghi",
          );
        }
        return;
      }

      const ids = await listSegmentIds(project, "video");
      if (!ids.length) {
        toast.error("Không có segment video trên draft local");
        return;
      }

      if (videoSub === "mask") {
        let n = 0;
        for (const sid of ids) {
          await local.localMask(project, sid, {
            name: maskNameForApi(mask.maskType),
            width: mask.size / 100,
            height: mask.size / 100,
            feather: mask.feather / 100,
          });
          n += 1;
          if (track !== "All") break;
        }
        toast.success(`Đã gắn mask ${mask.maskType} lên ${n} segment (local)`);
        return;
      }

      // Basic video enhance/stabilize chưa có pure Python — apply bg-blur nhẹ nếu enhance bật, else báo rõ
      let n = 0;
      for (const sid of ids) {
        if (basic.enhanceQuality || basic.reduceNoise) {
          await local.localBgBlur(project, sid, {
            level: basic.noiseLevel === "Weak" ? 1 : 2,
          }).catch(() => null);
        }
        n += 1;
        if (track !== "All") break;
      }
      if (basic.stabilize || basic.opticalFlow || basic.eyeContact) {
        toast(
          "Stabilize / Optical flow / Eye contact: UI giữ option — BE local chưa port",
        );
      }
      toast.success(
        n
          ? `Media basic: đã thử bg-blur trên ${n} segment (local)`
          : "Không có segment",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Apply media thất bại");
    } finally {
      setApplying(false);
    }
  };

  const addMaskLayer = () => {
    const n = mask.layers.length + 1;
    const layer: MediaMaskLayer = {
      id: `mask-${Date.now()}`,
      name: `Mask${n} Filmstrip`,
      type: mask.maskType,
    };
    setMask((prev) => ({
      ...prev,
      layers: [...prev.layers, layer],
      activeLayerId: layer.id,
    }));
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#1a1b1f]">
      <PanelGuide
        what="Chỉnh media trên draft CapCut: mask video, volume/fade audio (một phần basic video)."
        how="① Draft local → path · ② tab Video/Audio · ③ chỉnh thông số · ④ Apply."
        need={
          mate.localProject.trim()
            ? `Path: ${mate.localProject}`
            : "Path draft CapCut — menu «Draft local»."
        }
        tone={mate.localProject.trim() ? "default" : "warn"}
      />
      <div className="flex items-center gap-1 border-b border-white/8 px-4 py-2.5">
        {(
          [
            { id: "video" as const, label: "Video", icon: faFilm },
            { id: "audio" as const, label: "Audio", icon: faVolumeHigh },
          ] as const
        ).map((tab) => {
          const active = kind === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setKind(tab.id);
                setTrack("All");
              }}
              className={twMerge(
                "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                active
                  ? "bg-[#2a3140] text-sky-300 ring-1 ring-sky-400/40"
                  : "text-white/50 hover:bg-white/5 hover:text-white/80",
              )}
            >
              <FontAwesomeIcon icon={tab.icon} className="text-[12px]" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {kind === "video" && (
        <div className="flex gap-1 px-4 pt-3">
          {(
            [
              { id: "basic" as const, label: "Basic" },
              { id: "mask" as const, label: "Mask" },
            ] as const
          ).map((tab) => {
            const active = videoSub === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setVideoSub(tab.id)}
                className={twMerge(
                  "flex-1 rounded-full px-4 py-2 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-[#2a3140] text-sky-300 ring-1 ring-sky-400/40"
                    : "text-white/45 hover:bg-white/5 hover:text-white/70",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {kind === "audio" && (
        <div className="flex gap-1 px-4 pt-3">
          {(
            [
              { id: "basic" as const, label: "Basic" },
              { id: "voice-changer" as const, label: "Voice changer" },
            ] as const
          ).map((tab) => {
            const active = audioSub === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAudioSub(tab.id)}
                className={twMerge(
                  "flex-1 rounded-full px-4 py-2 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-[#2a3140] text-sky-300 ring-1 ring-sky-400/40"
                    : "text-white/45 hover:bg-white/5 hover:text-white/70",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      <ResizableSplit
        storageKey="capcut-split-media"
        defaultWidth={300}
        left={
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
              {kind === "audio" ? (
                <MediaAudioPanel
                  subTab={audioSub}
                  state={audio}
                  onChange={(patch) => setAudio((s) => ({ ...s, ...patch }))}
                />
              ) : videoSub === "basic" ? (
                <MediaBasicPanel
                  state={basic}
                  onChange={(patch) => setBasic((s) => ({ ...s, ...patch }))}
                />
              ) : (
                <MediaMaskPanel
                  state={mask}
                  onChange={(patch) => setMask((s) => ({ ...s, ...patch }))}
                  onAddLayer={addMaskLayer}
                />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/8 bg-[#15161a] px-4 py-3">
              {kind === "audio" && (
                <>
                  <span className="text-[12px] text-white/45">Media type</span>
                  <div className="relative">
                    <select
                      value={mediaType}
                      onChange={(e) => setMediaType(e.target.value)}
                      className="appearance-none rounded-lg border border-white/10 bg-[#252830] px-3 py-2 pr-8 text-[12px] text-white/80 outline-none focus:border-sky-400/40"
                    >
                      {[
                        "Audio segments",
                        "All audio",
                        "Music only",
                        "Voice only",
                      ].map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <FontAwesomeIcon
                      icon={faChevronDown}
                      className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[10px] text-white/40"
                    />
                  </div>
                </>
              )}
              <span className="text-[12px] text-white/45">Track</span>
              <div className="relative">
                <select
                  value={track}
                  onChange={(e) => setTrack(e.target.value)}
                  className="appearance-none rounded-lg border border-white/10 bg-[#252830] px-3 py-2 pr-8 text-[12px] text-white/80 outline-none focus:border-sky-400/40"
                >
                  {trackOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <FontAwesomeIcon
                  icon={faChevronDown}
                  className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[10px] text-white/40"
                />
              </div>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#252830] text-white/45 hover:text-white/80"
                title="Add"
                onClick={() =>
                  toast("Thêm layer mask — dùng nút trong panel Mask")
                }
              >
                <FontAwesomeIcon icon={faPlus} className="text-[12px]" />
              </button>
              <button
                type="button"
                disabled={applying}
                onClick={() => void handleApply()}
                className="rounded-lg bg-[#2b7cff] px-5 py-2 text-[13px] font-semibold text-white hover:bg-[#3a88ff] disabled:opacity-50"
              >
                {applying ? "…" : "Apply"}
              </button>
            </div>
          </div>
        }
        right={
          <PanelStatusAside tip="Media Apply ghi draft local (mask / volume / fade)." />
        }
      />
    </div>
  );
}
