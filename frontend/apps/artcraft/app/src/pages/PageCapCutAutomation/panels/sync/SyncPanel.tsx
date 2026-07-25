import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faChevronDown,
  faGear,
  faPlay,
} from "@fortawesome/pro-solid-svg-icons";
import { twMerge } from "tailwind-merge";
import toast from "react-hot-toast";
import { SYNC_TABS } from "../../constants";
import { RadioCard } from "../../shared/RadioCard";
import { Toggle } from "../../shared/Toggle";
import type {
  SyncCaptionSource,
  SyncMode,
  SyncTabId,
} from "../../types";
import { SyncCaptionSourceCards } from "./SyncCaptionSource";
import { SyncPreviewToolbar } from "./SyncPreviewToolbar";
import { SyncRunButton } from "./SyncRunButton";
import { SyncTimeline } from "./SyncTimeline";
import { SyncTransportBar } from "./SyncTransportBar";
import { useCapCutMate } from "../../api/CapCutMateContext";
import * as local from "../../api/capcutLocalClient";
import { requireLocalProject, secToUs } from "../../api/localApplyHelpers";
import { PanelGuide } from "../../shared/PanelGuide";
import { PanelStatusAside } from "../../shared/PanelStatusAside";
import { ResizableSplit } from "../../shared/ResizableSplit";

export function SyncPanel() {
  const mate = useCapCutMate();
  const [syncTab, setSyncTab] = useState<SyncTabId>("footage-audio");
  const [syncMode, setSyncMode] = useState<SyncMode>("one-to-one");
  const [fixedDuration, setFixedDuration] = useState(3);
  const [slowDown, setSlowDown] = useState(false);
  const [speedUp, setSpeedUp] = useState(false);
  const [offMagnet, setOffMagnet] = useState(false);
  const [offLinkage, setOffLinkage] = useState(false);
  const [preset, setPreset] = useState("");
  const [captionSource, setCaptionSource] =
    useState<SyncCaptionSource>("in-project");
  const [srtFile, setSrtFile] = useState<string | null>(null);
  const [srtPaste, setSrtPaste] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [showSceneTable, setShowSceneTable] = useState(true);
  const [sceneRows, setSceneRows] = useState<
    Array<{ index: number; text: string }>
  >([]);

  const isSubtitleMatch =
    syncTab === "footage-subs" || syncTab === "audio-subs";
  const isPreviewLayout =
    syncTab === "subs-audio" || syncTab === "scene-list";
  const mediaLabel =
    syncTab === "audio-subs" || syncTab === "subs-audio" ? "audio" : "footage";
  const matchTarget =
    syncTab === "footage-audio" ? "audio" : "subtitles";

  const handleRun = async () => {
    setIsRunning(true);
    const tabLabel = SYNC_TABS.find((t) => t.id === syncTab)?.label ?? syncTab;
    try {
      const project = requireLocalProject(mate.localProject);

      if (syncTab === "scene-list") {
        const res = (await local.localDetectScenes(project, {
          fixed_duration_us:
            syncMode === "fixed-duration" ? secToUs(fixedDuration) : undefined,
        })) as {
          scenes?: Array<Record<string, unknown>>;
          items?: Array<Record<string, unknown>>;
        };
        const raw = res.scenes || res.items || [];
        const rows = raw.map((s, i) => ({
          index: typeof s.index === "number" ? (s.index as number) : i + 1,
          text: String(s.text || s.label || `scene ${i + 1}`),
        }));
        // fallback: video segments as "scenes"
        if (!rows.length) {
          const segs = await local.localSegments(project, "video");
          const list = (segs.segments || []) as Array<{ id?: string }>;
          setSceneRows(
            list.map((s, i) => ({
              index: i + 1,
              text: String(s.id || `clip-${i + 1}`),
            })),
          );
        } else {
          setSceneRows(rows);
        }
        setShowSceneTable(true);
        toast.success(`Detect scenes · ${tabLabel} (${rows.length || "segments"})`);
        return;
      }

      if (isSubtitleMatch || syncTab === "subs-audio") {
        if (captionSource === "external-srt") {
          if (srtPaste.trim()) {
            await local.localImportSrt(project, { srt: srtPaste.trim() });
            toast.success("Đã import SRT vào draft local");
          } else if (srtFile) {
            await local.localImportSrt(project, { srt_path: srtFile });
            toast.success(`Import SRT path: ${srtFile}`);
          } else {
            toast.error("Dán nội dung SRT hoặc path file trước");
            return;
          }
        }
        // align caption track durations with media
        await local.localCaption(project, {
          mode: syncMode,
          slow_down: slowDown,
          speed_up: speedUp,
        });
        await local.localSyncTimelines(project);
        toast.success(`Sync phụ đề · ${tabLabel} (local)`);
        return;
      }

      // footage-audio: sync timelines + optional equal-divide via shift-all / speed
      await local.localSyncTimelines(project);
      if (syncMode === "fixed-duration") {
        toast(
          `Fixed ${fixedDuration}s/clip: UI flag đã gửi — BE sync-timelines không đổi duration từng clip (dùng local speed/trim nếu cần)`,
        );
      }
      toast.success(
        `Sync footage↔audio · ${syncMode}${slowDown || speedUp ? " · speed flags" : ""}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync thất bại");
    } finally {
      setIsRunning(false);
    }
  };

  const pickSrt = () => {
    const path = window.prompt(
      "Path file .srt trên máy (BE local đọc file):",
      srtFile || "",
    );
    if (path?.trim()) {
      setSrtFile(path.trim());
      setCaptionSource("external-srt");
      toast.success("Đã set path SRT");
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PanelGuide
        what="Đồng bộ timeline: footage↔audio, phụ đề, detect scene trên draft CapCut local."
        how="① Draft local → path · ② chọn tab (footage/subs/scene) · ③ tùy chọn mode · ④ RUN."
        need={
          mate.localProject.trim()
            ? `Path: ${mate.localProject}`
            : "Path draft CapCut — menu «Draft local»."
        }
        tone={mate.localProject.trim() ? "default" : "warn"}
      />
      <ResizableSplit
        storageKey="capcut-split-sync"
        defaultWidth={280}
        minWidth={220}
        maxWidth={400}
        left={
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      {(isSubtitleMatch || syncTab === "subs-audio") &&
        captionSource === "external-srt" && (
          <div className="border-b border-white/8 bg-[#15161a] px-3 py-2">
            <textarea
              value={srtPaste}
              onChange={(e) => setSrtPaste(e.target.value)}
              placeholder="Dán nội dung SRT (hoặc dùng path qua nút pick)…"
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-[#252830] px-3 py-2 font-mono text-[11px] text-white outline-none focus:border-sky-400/40"
            />
          </div>
        )}
      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-white/8 bg-[#1a1b1f] px-3 py-2">
        {SYNC_TABS.map((tab) => {
          const active = syncTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSyncTab(tab.id)}
              className={twMerge(
                "flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] transition-colors",
                active
                  ? "bg-[#2a3140] text-sky-300 ring-1 ring-sky-400/40"
                  : "text-white/55 hover:bg-white/5 hover:text-white/80",
              )}
            >
              <FontAwesomeIcon icon={tab.icon} className="text-[11px]" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="relative min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {/* Shared toolbar for mode tabs that use presets */}
        {(syncTab === "footage-audio" || isSubtitleMatch) && (
          <div className="mx-auto mb-4 flex max-w-4xl items-center gap-2">
            <button
              type="button"
              className="flex flex-1 items-center justify-between rounded-lg border border-white/10 bg-[#252830] px-3 py-2.5 text-left text-[13px] text-white/50 hover:border-white/20"
              onClick={() =>
                setPreset((p) => (p ? "" : "Default preset"))
              }
            >
              <span>{preset || "\u00A0"}</span>
              <FontAwesomeIcon
                icon={faChevronDown}
                className="text-[10px] opacity-50"
              />
            </button>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-[#252830] text-white/55 hover:bg-[#2a2d35]"
            >
              <FontAwesomeIcon icon={faBars} />
            </button>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-[#252830] text-white/55 hover:bg-[#2a2d35]"
              title="Preview"
            >
              <FontAwesomeIcon icon={faPlay} className="text-[12px]" />
            </button>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-[#252830] text-white/55 hover:bg-[#2a2d35]"
              title="Settings"
            >
              <FontAwesomeIcon icon={faGear} className="text-[12px]" />
            </button>
          </div>
        )}

        {/* Match Footage to Audio */}
        {syncTab === "footage-audio" && (
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="space-y-2">
              <RadioCard
                selected={syncMode === "one-to-one"}
                onSelect={() => setSyncMode("one-to-one")}
              >
                Match each footage to each audio clip (1-to-1 Sync)
              </RadioCard>
              <RadioCard
                selected={syncMode === "equal-divide"}
                onSelect={() => setSyncMode("equal-divide")}
              >
                Divide total audio duration equally for all footage
              </RadioCard>
              <RadioCard
                selected={syncMode === "fixed-duration"}
                onSelect={() => setSyncMode("fixed-duration")}
              >
                <span className="flex flex-wrap items-center gap-2">
                  Set fixed duration for each footage
                  <span
                    className="inline-flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={fixedDuration}
                      onChange={(e) =>
                        setFixedDuration(
                          Math.max(0.1, Number(e.target.value) || 0),
                        )
                      }
                      className="w-16 rounded-md border border-white/15 bg-[#1a1b1f] px-2 py-1 text-center text-[13px] text-white outline-none focus:border-white/20"
                    />
                    <span className="text-white/50">second/each footage</span>
                  </span>
                </span>
              </RadioCard>
            </div>
            <MatchToggles
              mediaLabel="footage"
              matchTarget="audio"
              slowDown={slowDown}
              speedUp={speedUp}
              offMagnet={offMagnet}
              offLinkage={offLinkage}
              onSlowDown={setSlowDown}
              onSpeedUp={setSpeedUp}
              onOffMagnet={setOffMagnet}
              onOffLinkage={setOffLinkage}
            />
          </div>
        )}

        {/* Footage↔Subs / Audio↔Subs */}
        {isSubtitleMatch && (
          <div className="mx-auto max-w-4xl space-y-4">
            <SyncCaptionSourceCards
              source={captionSource}
              onChange={setCaptionSource}
              srtFileName={srtFile}
              onPickSrt={pickSrt}
            />
            <MatchToggles
              mediaLabel={mediaLabel}
              matchTarget={matchTarget}
              slowDown={slowDown}
              speedUp={speedUp}
              offMagnet={offMagnet}
              offLinkage={offLinkage}
              onSlowDown={setSlowDown}
              onSpeedUp={setSpeedUp}
              onOffMagnet={setOffMagnet}
              onOffLinkage={setOffLinkage}
            />
          </div>
        )}

        {/* Match Subtitles to Audio / Scene List Sync */}
        {isPreviewLayout && (
          <div className="mx-auto max-w-5xl">
            <SyncPreviewToolbar onRunSmall={() => void handleRun()} />

            {syncTab === "scene-list" && showSceneTable && (
              <div className="relative mb-4 ml-20 max-w-lg">
                <div className="overflow-hidden rounded-lg border border-white/12 bg-[#e8e8ea] text-[#1a1b1f] shadow-xl">
                  <div className="flex items-center justify-between bg-white/90 px-3 py-1.5 text-[12px] font-medium">
                    <span>Scenes (từ BE detect / segments)</span>
                    <button
                      type="button"
                      onClick={() => setShowSceneTable(false)}
                      className="text-[#666] hover:text-black"
                    >
                      ×
                    </button>
                  </div>
                  <table className="w-full text-left text-[12px]">
                    <thead className="bg-white/80 text-[#333]">
                      <tr>
                        <th className="border-b border-black/10 px-3 py-1.5 font-semibold">
                          Index
                        </th>
                        <th className="border-b border-black/10 px-3 py-1.5 font-semibold">
                          scene_text
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sceneRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={2}
                            className="px-3 py-3 text-[#666]"
                          >
                            Chưa có data — bấm RUN để detect-scenes / list
                            segments
                          </td>
                        </tr>
                      ) : (
                        sceneRows.map((row) => (
                          <tr
                            key={row.index}
                            className="border-b border-black/5 last:border-0"
                          >
                            <td className="px-3 py-1.5 font-mono text-[#555]">
                              {row.index}
                            </td>
                            <td className="px-3 py-1.5">{row.text}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {syncTab === "scene-list" && !showSceneTable && (
              <button
                type="button"
                onClick={() => setShowSceneTable(true)}
                className="mb-4 ml-20 text-[12px] text-white/70 hover:underline"
              >
                Hiện bảng scenes
              </button>
            )}
          </div>
        )}

        {/* Floating RUN for non-transport layouts */}
        {!isPreviewLayout && (
          <SyncRunButton
            isRunning={isRunning}
            onClick={() => void handleRun()}
            className="absolute right-8 bottom-8"
          />
        )}
      </div>

      {/* Timeline */}
      <SyncTimeline
        variant={syncTab}
        showSyncedBadge={isSubtitleMatch}
      />

      {/* Transport for preview layouts */}
      {isPreviewLayout && (
        <SyncTransportBar
          isRunning={isRunning}
          onRun={() => void handleRun()}
        />
      )}
          </div>
        }
        right={
          <PanelStatusAside tip="Sync ghi draft CapCut local. Project trống (0 segment) → không sync được." />
        }
      />
    </div>
  );
}

function MatchToggles({
  mediaLabel,
  matchTarget,
  slowDown,
  speedUp,
  offMagnet,
  offLinkage,
  onSlowDown,
  onSpeedUp,
  onOffMagnet,
  onOffLinkage,
}: {
  mediaLabel: string;
  matchTarget: string;
  slowDown: boolean;
  speedUp: boolean;
  offMagnet: boolean;
  offLinkage: boolean;
  onSlowDown: (v: boolean) => void;
  onSpeedUp: (v: boolean) => void;
  onOffMagnet: (v: boolean) => void;
  onOffLinkage: (v: boolean) => void;
}) {
  return (
    <div className="grid max-w-3xl grid-cols-1 gap-x-12 gap-y-3 pt-1 sm:grid-cols-2">
      <Toggle
        checked={slowDown}
        onChange={onSlowDown}
        label={`Slow down ${mediaLabel} to match longer ${matchTarget}`}
      />
      <Toggle
        checked={offMagnet}
        onChange={onOffMagnet}
        label="Turn off main track magnet"
      />
      <Toggle
        checked={speedUp}
        onChange={onSpeedUp}
        label={`Speed up ${mediaLabel} to match shorter ${matchTarget}`}
      />
      <Toggle
        checked={offLinkage}
        onChange={onOffLinkage}
        label="Turn off Linkage"
      />
    </div>
  );
}
