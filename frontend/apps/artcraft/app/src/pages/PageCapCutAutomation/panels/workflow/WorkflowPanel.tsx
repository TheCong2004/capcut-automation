import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faGripVertical,
  faPlay,
  faPlus,
  faTrash,
} from "@fortawesome/pro-solid-svg-icons";
import { twMerge } from "tailwind-merge";
import toast from "react-hot-toast";
import { useCapCutMate } from "../../api/CapCutMateContext";
import * as api from "../../api/capcutBeClient";
import * as local from "../../api/capcutLocalClient";
import * as pipeline from "../../api/pipelineClient";
import { requireLocalProject } from "../../api/localApplyHelpers";
import { PanelGuide } from "../../shared/PanelGuide";
import { PanelStatusAside } from "../../shared/PanelStatusAside";
import { ResizableSplit } from "../../shared/ResizableSplit";

interface WorkflowStep {
  id: string;
  label: string;
  enabled: boolean;
  /** Map step → BE action key */
  action: WorkflowAction;
}

type WorkflowAction =
  | "save_draft"
  | "lint"
  | "sync_timelines"
  | "export_srt"
  | "gen_video"
  | "enqueue_pipeline"
  | "doctor"
  | "info"
  | "custom";

const DEFAULT_STEPS: WorkflowStep[] = [
  { id: "1", label: "Import / kiểm tra draft local", enabled: true, action: "info" },
  { id: "2", label: "Lint phụ đề & media", enabled: true, action: "lint" },
  { id: "3", label: "Sync timelines", enabled: true, action: "sync_timelines" },
  { id: "4", label: "Lưu draft mate", enabled: true, action: "save_draft" },
  { id: "5", label: "Tạo job Rust Pipeline (CommandDispatcher)", enabled: true, action: "enqueue_pipeline" },
  { id: "6", label: "Xuất video (gen_video)", enabled: false, action: "gen_video" },
];

export function WorkflowPanel() {
  const mate = useCapCutMate();
  const [name, setName] = useState("Default pipeline");
  const [steps, setSteps] = useState(DEFAULT_STEPS);
  const [onFailure, setOnFailure] = useState<"stop" | "skip" | "retry">("stop");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const append = (line: string) =>
    setLog((prev) => [...prev.slice(-80), line]);

  useEffect(() => {
    let unlistenStage: pipeline.UnlistenFn | undefined;
    let unlistenComplete: pipeline.UnlistenFn | undefined;
    let unlistenFailed: pipeline.UnlistenFn | undefined;

    async function setupListeners() {
      try {
        unlistenStage = await pipeline.listenStageComplete((payload) => {
          append(`[Event] Job ${payload.job_id} stage: ${payload.completed_stage} -> ${payload.next_stage}`);
        });
        unlistenComplete = await pipeline.listenJobComplete((payload) => {
          append(`[Event] Job ${payload.job_id} COMPLETE! Video: ${payload.video_url}`);
          toast.success(`Pipeline job completed!`);
        });
        unlistenFailed = await pipeline.listenJobFailed((payload) => {
          append(`[Event] Job ${payload.job_id} FAILED at ${payload.failed_stage}: ${payload.error_message}`);
          toast.error(`Pipeline job failed at ${payload.failed_stage}`);
        });
      } catch (err) {
        // Ignored if non-tauri runtime
      }
    }

    setupListeners();

    return () => {
      if (unlistenStage) unlistenStage();
      if (unlistenComplete) unlistenComplete();
      if (unlistenFailed) unlistenFailed();
    };
  }, []);

  const runAction = async (action: WorkflowAction, label: string) => {
    append(`▶ ${label} (${action})`);
    switch (action) {
      case "info": {
        const project = requireLocalProject(mate.localProject);
        const info = await local.localInfo(project);
        append(JSON.stringify(info).slice(0, 200));
        return;
      }
      case "lint": {
        const project = requireLocalProject(mate.localProject);
        const res = await local.localLint(project);
        append(JSON.stringify(res).slice(0, 240));
        return;
      }
      case "sync_timelines": {
        const project = requireLocalProject(mate.localProject);
        const res = await local.localSyncTimelines(project);
        append(JSON.stringify(res).slice(0, 200));
        return;
      }
      case "export_srt": {
        const project = requireLocalProject(mate.localProject);
        const res = await local.localExportSrt(project);
        append(`SRT ok=${String(res.ok)} len=${(res.srt || "").length}`);
        return;
      }
      case "doctor": {
        const res = await local.localDoctor();
        append(JSON.stringify(res).slice(0, 200));
        return;
      }
      case "save_draft": {
        let activeDraft = mate.draftUrl;
        if (!activeDraft) {
          append("▶ Tự động khởi tạo draft mate...");
          const res = await api.createDraft(mate.width, mate.height);
          activeDraft = res.draft_url;
          mate.setDraftUrl(activeDraft);
        }
        await api.saveDraft(activeDraft);
        append("save_draft OK");
        return;
      }
      case "gen_video": {
        let activeDraft = mate.draftUrl;
        if (!activeDraft) {
          append("▶ Tự động khởi tạo draft mate...");
          const res = await api.createDraft(mate.width, mate.height);
          activeDraft = res.draft_url;
          mate.setDraftUrl(activeDraft);
        }
        await api.genVideo(activeDraft);
        append("gen_video submitted");
        return;
      }
      case "enqueue_pipeline": {
        const jobId = await pipeline.enqueuePipelineJob(name || "Video prompt");
        append(`enqueue_pipeline OK -> Job ID: ${jobId}`);
        return;
      }
      default:
        append(`(skip custom) ${label}`);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    setLog([]);
    const enabled = steps.filter((s) => s.enabled);
    append(`Run “${name}” · ${enabled.length} bước`);
    try {
      for (const step of enabled) {
        let attempts = 0;
        const maxAttempts = onFailure === "retry" ? 2 : 1;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          attempts += 1;
          try {
            await runAction(step.action, step.label);
            break;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            append(`✗ ${step.label}: ${msg}`);
            if (attempts < maxAttempts) {
              append("  ↻ retry…");
              continue;
            }
            if (onFailure === "skip") {
              append("  → skip");
              break;
            }
            throw e;
          }
        }
      }
      toast.success(`Workflow “${name}” xong`);
      append("✓ Done");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Workflow dừng lỗi");
    } finally {
      setRunning(false);
    }
  };

  const handleSave = () => {
    try {
      localStorage.setItem(
        "capcut-workflow-" + name,
        JSON.stringify({ name, steps, onFailure }),
      );
      toast.success(`Đã lưu workflow “${name}” (localStorage)`);
    } catch {
      toast.error("Không lưu được");
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#1a1b1f]">
      <PanelGuide
        what="Chạy pipeline nhiều bước tuần tự (lint → sync → lưu draft → xuất video…)."
        how="① Bật/tắt step · ② chọn action từng bước · ③ Save (localStorage) · ④ Run workflow."
        need="Step local cần Draft local; step save/gen cần draft mate."
      />
      <ResizableSplit
        storageKey="capcut-split-workflow"
        defaultWidth={280}
        left={
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-white/8 px-5 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-semibold text-white/90">Workflow</h2>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-bold uppercase text-white">
            BE
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setSteps((s) => [
              ...s,
              {
                id: String(Date.now()),
                label: "Doctor env",
                enabled: true,
                action: "doctor",
              },
            ]);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#252830] px-3 py-1.5 text-[12px] text-white/70 hover:bg-[#2a2d35]"
        >
          <FontAwesomeIcon icon={faPlus} />
          Add step
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-xl space-y-4">
          <div>
            <div className="mb-1.5 text-[12px] text-white/50">Workflow name</div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#252830] px-3 py-2.5 text-[13px] text-white outline-none focus:border-sky-400/40"
            />
          </div>

          <div className="rounded-lg border border-white/8 bg-[#16171b] px-3 py-2 text-[11px] text-white/45">
            Chạy tuần tự API mate + local. Cần path local (lint/sync) và/hoặc
            draft mate (save/export).
          </div>

          <div>
            <div className="mb-2 text-[12px] text-white/50">Steps</div>
            <div className="space-y-1.5">
              {steps.map((step, i) => (
                <div
                  key={step.id}
                  className={twMerge(
                    "flex items-center gap-2 rounded-lg border border-white/8 bg-[#16171b] px-3 py-2.5",
                    !step.enabled && "opacity-50",
                  )}
                >
                  <FontAwesomeIcon
                    icon={faGripVertical}
                    className="text-[11px] text-white/25"
                  />
                  <span className="w-5 text-center text-[11px] text-white/35">
                    {i + 1}
                  </span>
                  <input
                    type="checkbox"
                    checked={step.enabled}
                    onChange={(e) =>
                      setSteps((prev) =>
                        prev.map((s) =>
                          s.id === step.id
                            ? { ...s, enabled: e.target.checked }
                            : s,
                        ),
                      )
                    }
                    className="h-3.5 w-3.5 rounded accent-sky-500"
                  />
                  <input
                    type="text"
                    value={step.label}
                    onChange={(e) =>
                      setSteps((prev) =>
                        prev.map((s) =>
                          s.id === step.id
                            ? { ...s, label: e.target.value }
                            : s,
                        ),
                      )
                    }
                    className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none"
                  />
                  <select
                    value={step.action}
                    onChange={(e) =>
                      setSteps((prev) =>
                        prev.map((s) =>
                          s.id === step.id
                            ? {
                                ...s,
                                action: e.target.value as WorkflowAction,
                              }
                            : s,
                        ),
                      )
                    }
                    className="max-w-[130px] rounded border border-white/10 bg-[#252830] px-1.5 py-1 text-[10px] text-white/70 outline-none"
                  >
                    <option value="info">local info</option>
                    <option value="lint">local lint</option>
                    <option value="sync_timelines">sync timelines</option>
                    <option value="export_srt">export SRT</option>
                    <option value="doctor">doctor</option>
                    <option value="save_draft">save draft</option>
                    <option value="enqueue_pipeline">enqueue pipeline</option>
                    <option value="gen_video">gen video</option>
                    <option value="custom">custom</option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setSteps((prev) => prev.filter((s) => s.id !== step.id))
                    }
                    className="flex h-7 w-7 items-center justify-center rounded-md text-white/30 hover:bg-white/5 hover:text-white/60"
                  >
                    <FontAwesomeIcon icon={faTrash} className="text-[11px]" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[12px] text-white/50">
              On step failure
            </div>
            <div className="relative">
              <select
                value={onFailure}
                onChange={(e) =>
                  setOnFailure(e.target.value as "stop" | "skip" | "retry")
                }
                className="w-full appearance-none rounded-lg border border-white/10 bg-[#252830] px-3 py-2.5 pr-8 text-[13px] text-white/80 outline-none"
              >
                <option value="stop">Stop workflow</option>
                <option value="skip">Skip step</option>
                <option value="retry">Retry once</option>
              </select>
              <FontAwesomeIcon
                icon={faChevronDown}
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[10px] text-white/40"
              />
            </div>
          </div>

          {log.length > 0 && (
            <pre className="max-h-40 overflow-auto rounded-lg border border-white/8 bg-black/40 p-3 font-mono text-[10px] text-emerald-200/80">
              {log.join("\n")}
            </pre>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-white/8 px-5 py-3">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-lg border border-white/12 bg-[#252830] px-4 py-2 text-[13px] text-white/75 hover:bg-[#2a2d35]"
        >
          Save
        </button>
        <button
          type="button"
          disabled={running}
          onClick={() => void handleRun()}
          className="flex items-center gap-2 rounded-lg bg-[#2b7cff] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#3a88ff] disabled:opacity-50"
        >
          <FontAwesomeIcon icon={faPlay} className="text-[11px]" />
          {running ? "Running…" : "Run workflow"}
        </button>
      </div>
          </div>
        }
        right={<PanelStatusAside tip="Workflow chạy tuần tự API mate + local." />}
      />
    </div>
  );
}
