import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowDown,
  faArrowUp,
  faChevronDown,
  faDesktop,
  faGear,
  faMinus,
} from "@fortawesome/pro-solid-svg-icons";
import { twMerge } from "tailwind-merge";
import toast from "react-hot-toast";
import { useCapCutMate } from "../../api/CapCutMateContext";
import * as api from "../../api/capcutBeClient";
import { PanelGuide } from "../../shared/PanelGuide";
import { PanelStatusAside } from "../../shared/PanelStatusAside";
import { ResizableSplit } from "../../shared/ResizableSplit";

type AfterCompletion = "nothing" | "sleep" | "shutdown";

const TASKS = [
  "Chỉ xuất video",
  "Lưu + Xuất",
  "Full (lưu rồi xuất)",
];

/** BE: save_draft · gen_video · gen_video_status */
export function AutoRenderPanel() {
  const mate = useCapCutMate();
  const [task, setTask] = useState(TASKS[0]);
  const [after, setAfter] = useState<AfterCompletion>("nothing");
  const [monitor, setMonitor] = useState(1);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const pollStatus = async (draftUrl: string) => {
    const maxAttempts = 120;
    for (let i = 0; i < maxAttempts; i++) {
      const st = await api.genVideoStatus(draftUrl);
      setStatus(st.status);
      setProgress(st.progress ?? 0);
      if (st.status === "completed") {
        setVideoUrl(st.video_url || null);
        toast.success("Xuất video xong");
        return;
      }
      if (st.status === "failed") {
        throw new Error(st.error_message || "Xuất video thất bại");
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    toast("Vẫn đang xử lý — kiểm tra lại sau");
  };

  const handleRun = async () => {
    setRunning(true);
    setProgress(0);
    setStatus("starting");
    setVideoUrl(null);
    try {
      const draftUrl = mate.ensureDraft();

      if (task.includes("Lưu") || task.includes("Full")) {
        await api.saveDraft(draftUrl);
        toast.success("Đã lưu draft");
      }

      await api.genVideo(draftUrl);
      toast.success("Đã gửi job xuất video");
      setStatus("pending");
      await pollStatus(draftUrl);

      if (after === "sleep" || after === "shutdown") {
        toast(
          "Ngủ/Tắt máy là thao tác hệ điều hành — capcut-mate không xử lý",
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Xuất video thất bại");
      setStatus("error");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[#1a1b1f]">
      <PanelGuide
        what="Xuất video từ draft mate: lưu (tuỳ chọn) → gen_video → theo dõi tiến độ."
        how="① Thêm nguyên liệu / effect trước · ② chọn loại task · ③ CHẠY · ④ chờ status completed."
        need={
          mate.draftUrl
            ? "Đã có draft mate. Máy BE cần môi trường Jianying export."
            : "Draft mate — «Tạo draft» + thêm media trước."
        }
        tone={mate.draftUrl ? "default" : "warn"}
      />
      <ResizableSplit
        storageKey="capcut-split-autorender"
        defaultWidth={280}
        left={
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-white/8 px-5 py-3">
        <h2 className="text-[15px] font-semibold text-white/90">
          Hàng đợi xuất video
        </h2>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md bg-[#252830] text-white/45 hover:text-white/80"
            title="Move up"
          >
            <FontAwesomeIcon icon={faArrowUp} className="text-[11px]" />
          </button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md bg-[#252830] text-white/45 hover:text-white/80"
            title="Move down"
          >
            <FontAwesomeIcon icon={faArrowDown} className="text-[11px]" />
          </button>
          <button
            type="button"
            className="mt-1 flex h-8 w-8 items-center justify-center rounded-md bg-[#252830] text-white/45 hover:text-white/80"
            title="Remove"
          >
            <FontAwesomeIcon icon={faMinus} className="text-[11px]" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="mb-10 text-center text-[13px] leading-7 text-white/35">
          <p>1. Tạo draft (thanh trên) và thêm nguyên liệu</p>
          <p>2. Chọn loại xuất bên dưới</p>
          <p>3. Bấm CHẠY → gen_video + theo dõi tiến độ</p>
        </div>

        <div className="mx-auto max-w-xl space-y-6">
          <div>
            <div className="mb-2 text-[13px] font-medium text-white/80">
              Chọn tác vụ
            </div>
            <div className="relative">
              <select
                value={task}
                onChange={(e) => setTask(e.target.value)}
                className="w-full appearance-none rounded-lg border border-white/10 bg-[#252830] px-3 py-2.5 pr-9 text-[13px] text-white/85 outline-none focus:border-sky-400/40"
              >
                {TASKS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <FontAwesomeIcon
                icon={faChevronDown}
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[11px] text-white/40"
              />
            </div>
          </div>

          <div>
            <div className="mb-2 text-[13px] font-medium text-white/80">
              Sau khi xong
            </div>
            <div className="flex flex-wrap gap-4">
              {(
                [
                  { id: "nothing" as const, label: "Không làm gì" },
                  { id: "sleep" as const, label: "Ngủ máy (chỉ UI)" },
                  { id: "shutdown" as const, label: "Tắt máy (chỉ UI)" },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.id}
                  className="flex cursor-pointer items-center gap-2 text-[13px] text-white/75 select-none"
                >
                  <input
                    type="checkbox"
                    checked={after === opt.id}
                    onChange={() => setAfter(opt.id)}
                    className="h-3.5 w-3.5 rounded accent-sky-500"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-[13px] font-medium text-white/80">
              Xuất qua BE
            </div>
            <button
              type="button"
              onClick={() =>
                toast("Preset xuất do Jianying/CapCut trên máy chạy BE quyết định")
              }
              className="flex items-center gap-2 rounded-lg border border-white/12 bg-[#252830] px-3 py-2 text-[12px] text-white/70 hover:bg-[#2a2d35] hover:text-white"
            >
              <FontAwesomeIcon icon={faGear} className="text-[12px]" />
              Cài đặt
            </button>
            <p className="mt-2 text-[12px] text-white/50">
              Cần capcut-mate + môi trường xuất Jianying trên máy BE
            </p>
          </div>

          {(status || progress !== null) && (
            <div className="rounded-lg border border-white/10 bg-[#16171b] px-4 py-3">
              <div className="mb-1 flex justify-between text-[12px] text-white/70">
                <span>Trạng thái: {status ?? "—"}</span>
                <span>{progress ?? 0}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-rose-400 transition-all"
                  style={{ width: `${Math.min(100, progress ?? 0)}%` }}
                />
              </div>
              {videoUrl && (
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block truncate text-[11px] text-sky-300 hover:underline"
                >
                  {videoUrl}
                </a>
              )}
            </div>
          )}

          <div>
            <div className="mb-3 text-[13px] font-medium text-white/80">
              Màn hình CapCut
            </div>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setMonitor(1)}
                className={twMerge(
                  "flex h-28 w-44 flex-col items-center justify-center rounded-lg border-2 transition-colors",
                  monitor === 1
                    ? "border-white/25 bg-white/6 text-white/85"
                    : "border-white/10 bg-[#1e2026] text-white/50 hover:border-white/20",
                )}
              >
                <FontAwesomeIcon icon={faDesktop} className="mb-2 text-lg" />
                <span className="text-[13px] font-medium">Màn 1 *</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleRun()}
        disabled={running}
        className={twMerge(
          "absolute right-10 bottom-10 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-b from-cyan-300 to-cyan-500 text-sm font-bold tracking-wide text-[#0b1a1f] shadow-lg shadow-cyan-500/25 transition hover:brightness-110",
          running && "opacity-70",
        )}
      >
        {running ? "…" : "CHẠY"}
      </button>
          </div>
        }
        right={
          <PanelStatusAside tip="Xuất video cần draft mate + env Jianying trên máy BE." />
        }
      />
    </div>
  );
}
