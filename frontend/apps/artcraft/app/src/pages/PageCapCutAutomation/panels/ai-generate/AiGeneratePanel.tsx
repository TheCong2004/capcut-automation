import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUpFromBracket,
  faBorderAll,
  faChevronDown,
  faExpand,
  faFileLines,
  faGear,
  faList,
  faPlus,
  faSquare,
  faTrash,
} from "@fortawesome/pro-solid-svg-icons";
import { twMerge } from "tailwind-merge";
import toast from "react-hot-toast";
import { useCapCutMate } from "../../api/CapCutMateContext";
import * as local from "../../api/capcutLocalClient";
import { requireLocalProject } from "../../api/localApplyHelpers";
import { PanelGuide } from "../../shared/PanelGuide";
import { ResizableSplit } from "../../shared/ResizableSplit";

type AiTab = "image" | "voice";

export function AiGeneratePanel() {
  const mate = useCapCutMate();
  const [tab, setTab] = useState<AiTab>("image");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("Seedream 4.3");
  const [aspect, setAspect] = useState("16:9");
  const [count, setCount] = useState(1);
  const [size, setSize] = useState<"2k" | "4k">("2k");
  const [savePath, setSavePath] = useState(
    "C:\\Users\\thecong\\Pictures\\CapcutPil",
  );
  const [saveInTxtFolder, setSaveInTxtFolder] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stats] = useState({
    total: 0,
    pending: 0,
    running: 0,
    done: 0,
    failed: 0,
    stopped: 0,
  });

  /** capcut-mate chưa có AI image gen — wire local quickstart/compile + note. */
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Nhập prompt");
      return;
    }
    setBusy(true);
    try {
      // Best-effort: local quickstart scaffold if path set
      if (mate.localProject.trim()) {
        const project = requireLocalProject(mate.localProject);
        await local.localQuickstart({
          project,
          prompt: prompt.trim(),
          model,
          aspect,
          count,
          size,
          out_dir: savePath,
        });
        toast.success("Đã gửi local/quickstart (nếu BE hỗ trợ prompt)");
      } else {
        toast(
          "capcut-mate không có Seedream/AI image — dùng ArtCraft Omni hoặc set draft local + quickstart",
          { duration: 5000 },
        );
      }
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "AI gen chưa có trên BE CapCut — chỉ scaffold UI",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#1a1b1f]">
      <PanelGuide
        what="UI tạo ảnh/voice AI (Seedream…). capcut-mate hiện không có model gen ảnh."
        how="① Nhập prompt · ② model/size · ③ Add Prompts. Có path local thì thử quickstart."
        need="Gen ảnh thật: dùng ArtCraft Omni / service AI khác. Panel này chủ yếu scaffold."
        tone="warn"
      />
      {/* AI Image / AI Voice */}
      <div className="flex items-center gap-6 border-b border-white/8 px-5">
        {(
          [
            { id: "image" as const, label: "AI Image" },
            { id: "voice" as const, label: "AI Voice" },
          ] as const
        ).map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={twMerge(
                "relative py-3 text-[13px] font-medium transition-colors",
                active ? "text-white/80" : "text-white/45 hover:text-white/70",
              )}
            >
              {t.label}
              {active && (
                <span className="absolute right-0 bottom-0 left-0 h-0.5 rounded-full bg-white/40" />
              )}
            </button>
          );
        })}
      </div>

      {tab === "voice" ? (
        <div className="flex flex-1 items-center justify-center text-[13px] text-white/40">
          AI Voice: BE CapCut Mate chưa có TTS. Dùng tab Image + quickstart local
          hoặc ArtCraft Omni.
        </div>
      ) : (
        <ResizableSplit
          resizeSide="left"
          storageKey="capcut-split-ai"
          defaultWidth={340}
          minWidth={280}
          maxWidth={480}
          left={
          <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto border-r border-white/8">
            <div className="flex items-center gap-2 border-b border-white/6 px-4 py-2.5 text-[11px]">
              <span className="text-white/45">CapCut Plan:</span>
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-white/70">
                Free
              </span>
              <span className="text-white/45">Credits:</span>
              <span className="text-white/55">0</span>
              <span className="text-white/45">Prompts:</span>
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-white/80">
                0
              </span>
            </div>

            <div className="flex items-center gap-1 px-3 py-2">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md text-white/40 hover:bg-white/5"
                title="Import"
              >
                <FontAwesomeIcon icon={faFileLines} className="text-[12px]" />
              </button>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md text-white/40 hover:bg-white/5"
                title="Clear"
              >
                <FontAwesomeIcon icon={faTrash} className="text-[12px]" />
              </button>
            </div>

            <div className="px-3 pb-3">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={8}
                placeholder={`Describe the image you want to generate...

For multiple prompts, put each prompt on a new line.

JSON format is supported.
Each object inside {...} will be treated as one prompt.

Example:
{"prompt":"a cat in space"}`}
                className="w-full resize-none rounded-lg border border-white/10 bg-[#121317] px-3 py-2.5 text-[12px] leading-relaxed text-white outline-none placeholder:text-white/25 focus:border-sky-400/40"
              />
            </div>

            <div className="space-y-4 px-3 pb-4">
              <div>
                <div className="mb-1.5 text-[12px] text-white/55">Model</div>
                <div className="relative">
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-white/20 bg-[#252830] px-3 py-2.5 pr-8 text-[13px] text-white outline-none"
                  >
                    {["Seedream 4.3", "Seedream 3.0", "Flux Pro"].map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute top-1/2 right-8 -translate-y-1/2 rounded bg-white/15 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    Free
                  </span>
                  <FontAwesomeIcon
                    icon={faChevronDown}
                    className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[10px] text-white/40"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 text-[12px] text-white/55">
                  Aspect ratio
                </div>
                <div className="relative">
                  <select
                    value={aspect}
                    onChange={(e) => setAspect(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-white/10 bg-[#252830] px-3 py-2 pr-8 text-[13px] text-white/80 outline-none"
                  >
                    {["16:9", "9:16", "1:1", "4:3", "3:4"].map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                  <FontAwesomeIcon
                    icon={faChevronDown}
                    className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[10px] text-white/40"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 text-[12px] text-white/55">
                  Number of images
                </div>
                <div className="flex overflow-hidden rounded-lg border border-white/10">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCount(n)}
                      className={twMerge(
                        "flex-1 py-2 text-[13px] font-medium transition-colors",
                        count === n
                          ? "bg-sky-500 text-white"
                          : "bg-[#1e2026] text-white/50 hover:bg-[#252830]",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1.5 text-[12px] text-white/55">Image Size</div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSize("2k")}
                    className={twMerge(
                      "flex-1 rounded-lg py-2.5 text-[13px] font-semibold transition-colors",
                      size === "2k"
                        ? "bg-white/12 text-white ring-1 ring-white/12"
                        : "bg-[#1e2026] text-white/50 hover:bg-[#252830]",
                    )}
                  >
                    2K
                  </button>
                  <button
                    type="button"
                    onClick={() => setSize("4k")}
                    className={twMerge(
                      "relative flex-1 rounded-lg py-2.5 text-[13px] font-semibold transition-colors",
                      size === "4k"
                        ? "bg-white/12 text-white ring-1 ring-white/12"
                        : "bg-[#1e2026] text-white/50 hover:bg-[#252830]",
                    )}
                  >
                    4K
                    <span className="absolute top-1 right-1 rounded bg-white/15 px-1 text-[8px] font-bold text-white">
                      Ultra
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-1.5 text-[12px] text-white/55">
                  Reference image (optional)
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const p = window.prompt(
                      "Path ảnh reference trên máy (BE local quickstart, nếu hỗ trợ):",
                      "",
                    );
                    if (p?.trim()) toast.success(`Reference: ${p.trim()}`);
                  }}
                  className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-white/15 bg-[#121317] text-white/35 hover:border-white/18 hover:text-white/80"
                >
                  <FontAwesomeIcon icon={faArrowUpFromBracket} />
                </button>
              </div>

              <div>
                <div className="mb-1.5 text-[12px] text-white/55">Save to</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={savePath}
                    onChange={(e) => setSavePath(e.target.value)}
                    className="min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-[#252830] px-3 py-2 text-[12px] text-white/80 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const p = window.prompt("Thư mục lưu output:", savePath);
                      if (p != null) setSavePath(p.trim());
                    }}
                    className="shrink-0 rounded-lg border border-white/12 bg-[#252830] px-3 py-2 text-[12px] text-white/70 hover:bg-[#2a2d35]"
                  >
                    Browse
                  </button>
                </div>
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-white/45 select-none">
                  <input
                    type="checkbox"
                    checked={saveInTxtFolder}
                    onChange={(e) => setSaveInTxtFolder(e.target.checked)}
                    className="h-3 w-3 rounded accent-sky-500"
                  />
                  Save images in the .txt file&apos;s folder
                  <FontAwesomeIcon
                    icon={faGear}
                    className="ml-auto text-white/30"
                  />
                </label>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => void handleGenerate()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2b7cff] py-3 text-[14px] font-semibold text-white hover:bg-[#3a88ff] disabled:opacity-50"
              >
                <FontAwesomeIcon icon={faPlus} />
                {busy ? "…" : "Add Prompts"}
              </button>
            </div>
          </div>
          }
          right={
          <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-end gap-1 border-b border-white/6 px-3 py-2 text-white/40">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/5 hover:text-white/70"
              >
                <FontAwesomeIcon icon={faBorderAll} className="text-[12px]" />
              </button>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/5 hover:text-white/70"
              >
                <FontAwesomeIcon icon={faList} className="text-[12px]" />
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] hover:bg-white/5 hover:text-white/70"
              >
                <FontAwesomeIcon icon={faSquare} className="text-[11px]" />
                Select all
              </button>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/5 hover:text-white/70"
              >
                <FontAwesomeIcon icon={faTrash} className="text-[12px]" />
              </button>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/5 hover:text-white/70"
              >
                <FontAwesomeIcon icon={faExpand} className="text-[12px]" />
              </button>
            </div>

            <div className="flex flex-1 items-center justify-center text-[13px] text-white/30">
              Generated images will appear here.
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-white/8 px-4 py-2.5 text-[12px]">
              <span className="text-white/70">
                Total: <span className="text-white">{stats.total}</span>
              </span>
              <span className="text-white/55">
                Pending: {stats.pending}
              </span>
              <span className="text-white/80">
                Running: {stats.running}
              </span>
              <span className="text-white/55">Done: {stats.done}</span>
              <span className="text-white/50">Failed: {stats.failed}</span>
              <span className="text-white/55">Stopped: {stats.stopped}</span>
            </div>
          </div>
          }
        />
      )}
    </div>
  );
}
