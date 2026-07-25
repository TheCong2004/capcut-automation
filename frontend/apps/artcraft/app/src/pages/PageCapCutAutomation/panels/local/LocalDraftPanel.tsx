/**
 * UI cho API pure Python /v1/local/* (draft trên đĩa).
 */
import { useCallback, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFolderOpen,
  faHardDrive,
  faPlay,
  faRotate,
  faStethoscope,
} from "@fortawesome/pro-solid-svg-icons";
import { twMerge } from "tailwind-merge";
import toast from "react-hot-toast";
import { useCapCutMate } from "../../api/CapCutMateContext";
import * as local from "../../api/capcutLocalClient";
import { PanelGuide } from "../../shared/PanelGuide";
import { PanelStatusAside } from "../../shared/PanelStatusAside";
import { ResizableSplit } from "../../shared/ResizableSplit";

type TabId = "inspect" | "edit" | "srt" | "tools";

export function LocalDraftPanel() {
  const mate = useCapCutMate();
  const [tab, setTab] = useState<TabId>("inspect");
  const [pathInput, setPathInput] = useState(mate.localProject);
  const [busy, setBusy] = useState(false);

  // Đồng bộ khi chọn project từ panel «Tất cả dự án»
  useEffect(() => {
    setPathInput(mate.localProject);
  }, [mate.localProject]);
  const [infoJson, setInfoJson] = useState("");
  const [segments, setSegments] = useState<
    Array<{ id?: string; track_type?: string; speed?: number; volume?: number }>
  >([]);
  const [selectedSeg, setSelectedSeg] = useState("");
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [srtText, setSrtText] = useState("");
  const [log, setLog] = useState("");

  const project = mate.localProject.trim();

  const savePath = () => {
    mate.setLocalProject(pathInput.trim());
    toast.success("Đã lưu đường dẫn draft local");
  };

  const run = useCallback(
    async (fn: () => Promise<unknown>, okMsg?: string) => {
      if (!project) {
        toast.error("Nhập path folder draft CapCut trước");
        return;
      }
      setBusy(true);
      try {
        const res = await fn();
        setLog(JSON.stringify(res, null, 2));
        if (okMsg) toast.success(okMsg);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Lỗi API local");
        setLog(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [project],
  );

  const loadInfo = () =>
    run(async () => {
      const info = await local.localInfo(project);
      setInfoJson(JSON.stringify(info, null, 2));
      const segs = await local.localSegments(project);
      const list = (segs.segments || []) as Array<{
        id?: string;
        track_type?: string;
        speed?: number;
        volume?: number;
      }>;
      setSegments(list);
      if (list[0]?.id) setSelectedSeg(String(list[0].id));
      return info;
    }, "Đã tải info draft");

  const tabs: { id: TabId; label: string }[] = [
    { id: "inspect", label: "Xem draft" },
    { id: "edit", label: "Sửa segment" },
    { id: "srt", label: "Phụ đề SRT" },
    { id: "tools", label: "Công cụ" },
  ];

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#1a1b1f]">
      <PanelGuide
        what="Trỏ tới project CapCut trên ổ đĩa để các mục Sync / Transition / Keyframe… sửa file thật."
        how="① Dán path folder draft (có draft_content.json) · ② Lưu path · ③ Tải info · ④ tab Sửa / SRT / Công cụ."
        need="Folder CapCut User Data → Projects → … (không phải draft mate trên server)."
        tone={project ? "default" : "warn"}
      />
      <div className="border-b border-white/8 px-5 py-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-white/90">
          <FontAwesomeIcon icon={faHardDrive} className="text-emerald-400" />
          Draft local (pure Python)
        </h2>
        <p className="mt-0.5 text-[12px] text-white/40">
          API <code className="text-white/55">/v1/local/*</code> — sửa file
          draft CapCut trên máy
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2 border-b border-white/6 px-4 py-3">
        <div className="min-w-[280px] flex-1">
          <label className="mb-1 block text-[11px] text-white/45">
            Path folder draft (hoặc draft_content.json)
          </label>
          <input
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            placeholder="C:\Users\…\CapCut\User Data\Projects\…\draft_xxx"
            className="w-full rounded-lg border border-white/10 bg-[#252830] px-3 py-2 font-mono text-[12px] text-white outline-none focus:border-emerald-400/40"
          />
        </div>
        <button
          type="button"
          onClick={savePath}
          className="rounded-lg border border-white/12 bg-[#252830] px-3 py-2 text-[12px] text-white/80 hover:bg-[#2a2d35]"
        >
          <FontAwesomeIcon icon={faFolderOpen} className="mr-1.5" />
          Lưu path
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void loadInfo()}
          className="rounded-lg bg-emerald-500/90 px-3 py-2 text-[12px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          <FontAwesomeIcon icon={faRotate} className="mr-1.5" />
          Tải info
        </button>
      </div>

      <div className="flex gap-1 border-b border-white/6 px-3 py-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={twMerge(
              "rounded-full px-3 py-1.5 text-[12px]",
              tab === t.id
                ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30"
                : "text-white/50 hover:bg-white/5",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ResizableSplit
        storageKey="capcut-split-local-draft"
        defaultWidth={300}
        minWidth={240}
        maxWidth={480}
        left={
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {tab === "inspect" && (
          <div className="space-y-3">
            <pre className="max-h-80 overflow-auto rounded-lg border border-white/8 bg-[#121318] p-3 font-mono text-[11px] text-white/70">
              {infoJson || "Bấm «Tải info» để xem JSON draft…"}
            </pre>
            {segments.length > 0 && (
              <div>
                <div className="mb-2 text-[12px] text-white/50">
                  Segments ({segments.length})
                </div>
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {segments.map((s) => (
                    <button
                      key={String(s.id)}
                      type="button"
                      onClick={() => {
                        setSelectedSeg(String(s.id));
                        setSpeed(Number(s.speed) || 1);
                        setVolume(Number(s.volume) || 1);
                      }}
                      className={twMerge(
                        "flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-left font-mono text-[11px]",
                        selectedSeg === s.id
                          ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                          : "border-white/8 bg-[#16171b] text-white/60 hover:border-white/15",
                      )}
                    >
                      <span className="truncate">{s.id}</span>
                      <span className="shrink-0 text-white/35">
                        {s.track_type} · sp={s.speed} vol={s.volume}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "edit" && (
          <div className="mx-auto max-w-lg space-y-4">
            <div>
              <label className="mb-1 block text-[11px] text-white/45">
                segment_id
              </label>
              <input
                value={selectedSeg}
                onChange={(e) => setSelectedSeg(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#252830] px-3 py-2 font-mono text-[12px] text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] text-white/45">
                  Speed
                </label>
                <input
                  type="number"
                  step={0.1}
                  min={0.1}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value) || 1)}
                  className="w-full rounded-lg border border-white/10 bg-[#252830] px-3 py-2 text-[13px] text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-white/45">
                  Volume
                </label>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-white/10 bg-[#252830] px-3 py-2 text-[13px] text-white"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !selectedSeg}
                onClick={() =>
                  void run(
                    () => local.localSpeed(project, selectedSeg, speed),
                    "Đã đặt speed",
                  )
                }
                className="rounded-lg bg-emerald-500/90 px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
              >
                Áp dụng speed
              </button>
              <button
                type="button"
                disabled={busy || !selectedSeg}
                onClick={() =>
                  void run(
                    () => local.localVolume(project, selectedSeg, volume),
                    "Đã đặt volume",
                  )
                }
                className="rounded-lg border border-white/12 bg-[#252830] px-3 py-2 text-[12px] text-white/85 disabled:opacity-50"
              >
                Áp dụng volume
              </button>
              <button
                type="button"
                disabled={busy || !selectedSeg}
                onClick={() =>
                  void run(
                    () =>
                      local.localKeyframe(
                        project,
                        selectedSeg,
                        "KFTypePositionX",
                        0,
                        0.1,
                      ),
                    "Đã thêm keyframe PositionX",
                  )
                }
                className="rounded-lg border border-white/12 bg-[#252830] px-3 py-2 text-[12px] text-white/85 disabled:opacity-50"
              >
                + Keyframe X
              </button>
              <button
                type="button"
                disabled={busy || !selectedSeg}
                onClick={() =>
                  void run(
                    () =>
                      local.localMask(project, selectedSeg, {
                        name: "圆形",
                      }),
                    "Đã gắn mask tròn",
                  )
                }
                className="rounded-lg border border-white/12 bg-[#252830] px-3 py-2 text-[12px] text-white/85 disabled:opacity-50"
              >
                Mask tròn
              </button>
            </div>
          </div>
        )}

        {tab === "srt" && (
          <div className="mx-auto max-w-xl space-y-3">
            <textarea
              value={srtText}
              onChange={(e) => setSrtText(e.target.value)}
              rows={10}
              placeholder={`1\n00:00:00,000 --> 00:00:03,000\nXin chào`}
              className="w-full rounded-lg border border-white/10 bg-[#252830] px-3 py-2 font-mono text-[11px] text-white outline-none focus:border-emerald-400/40"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => local.localImportSrt(project, { srt: srtText }),
                    "Đã import SRT",
                  )
                }
                className="rounded-lg bg-emerald-500/90 px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
              >
                Import SRT vào draft
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const r = await local.localExportSrt(project);
                    if (r.srt) setSrtText(String(r.srt));
                    return r;
                  }, "Đã export SRT")
                }
                className="rounded-lg border border-white/12 bg-[#252830] px-3 py-2 text-[12px] text-white/85 disabled:opacity-50"
              >
                Export SRT
              </button>
            </div>
          </div>
        )}

        {tab === "tools" && (
          <div className="mx-auto max-w-lg space-y-3">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(() => local.localDoctor(), "Doctor xong")
              }
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/12 bg-[#252830] py-2.5 text-[13px] text-white/85 hover:bg-[#2a2d35] disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faStethoscope} />
              Doctor (BE local)
            </button>
            <button
              type="button"
              disabled={busy || !project}
              onClick={() =>
                void run(() => local.localLint(project), "Lint xong")
              }
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/12 bg-[#252830] py-2.5 text-[13px] text-white/85 disabled:opacity-50"
            >
              Lint draft
            </button>
            <button
              type="button"
              disabled={busy || !project}
              onClick={() =>
                void run(
                  () => local.localProjects(),
                  "Đã list projects",
                )
              }
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/12 bg-[#252830] py-2.5 text-[13px] text-white/85 disabled:opacity-50"
            >
              List projects local
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(() => local.localPortMatrix(), "Port matrix")
              }
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500/20 py-2.5 text-[13px] text-emerald-200 ring-1 ring-emerald-400/30 disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faPlay} />
              Xem port-matrix
            </button>
          </div>
        )}

        {log && (
          <pre className="mt-4 max-h-48 overflow-auto rounded-lg border border-white/8 bg-[#0e0f12] p-3 font-mono text-[10px] text-white/50">
            {log}
          </pre>
        )}
      </div>
        }
        right={
          <PanelStatusAside tip="Draft local = project CapCut trên đĩa. Chọn project bên panel phải cho nhanh." />
        }
      />
    </div>
  );
}
