import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircle,
  faFloppyDisk,
  faGear,
  faPlus,
  faRotate,
} from "@fortawesome/pro-solid-svg-icons";
import { twMerge } from "tailwind-merge";
import toast from "react-hot-toast";
import { useCapCutMate } from "../api/CapCutMateContext";

const PRESETS: { label: string; w: number; h: number }[] = [
  { label: "9:16 1080 (dọc)", w: 1080, h: 1920 },
  { label: "16:9 1080 (ngang)", w: 1920, h: 1080 },
  { label: "1:1 1080 (vuông)", w: 1080, h: 1080 },
  { label: "16:9 720", w: 1280, h: 720 },
];

/** Thanh draft + kết nối BE capcut-mate */
export function ProjectBar() {
  const mate = useCapCutMate();
  const [showSettings, setShowSettings] = useState(false);
  const [urlEdit, setUrlEdit] = useState(mate.baseUrl);

  const statusColor =
    mate.online === null
      ? "text-white/35"
      : mate.online
        ? "text-emerald-400"
        : "text-rose-400";

  const draftId =
    mate.draftUrl?.match(/draft_id=([^&]+)/)?.[1] ??
    (mate.draftUrl ? "draft" : null);

  return (
    <div className="flex shrink-0 flex-col border-b border-white/8 bg-[#121318]">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          title="Làm mới trạng thái backend"
          onClick={() => void mate.refreshOnline()}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-white/60 hover:bg-white/5"
        >
          <FontAwesomeIcon
            icon={faCircle}
            className={twMerge("text-[8px]", statusColor)}
          />
          <span>
            {mate.checking
              ? "Đang kiểm tra…"
              : mate.online
                ? "BE online"
                : mate.online === false
                  ? "BE offline"
                  : "BE ?"}
          </span>
          <FontAwesomeIcon icon={faRotate} className="text-[10px] opacity-50" />
        </button>

        <div className="h-4 w-px bg-white/10" />

        <select
          value={`${mate.width}x${mate.height}`}
          onChange={(e) => {
            const p = PRESETS.find((x) => `${x.w}x${x.h}` === e.target.value);
            if (p) mate.setCanvasSize(p.w, p.h);
          }}
          className="rounded-md border border-white/10 bg-[#1e2026] px-2 py-1 text-[11px] text-white/80 outline-none"
          title="Kích thước canvas khi tạo draft mới"
        >
          {PRESETS.map((p) => (
            <option key={p.label} value={`${p.w}x${p.h}`}>
              {p.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={mate.busy}
          onClick={() => void mate.createProject()}
          className="flex items-center gap-1.5 rounded-md bg-sky-500/90 px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
        >
          <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
          Tạo draft
        </button>

        <button
          type="button"
          disabled={mate.busy || !mate.draftUrl}
          onClick={() => void mate.saveProject()}
          className="flex items-center gap-1.5 rounded-md border border-white/12 bg-[#252830] px-2.5 py-1 text-[12px] text-white/80 hover:bg-[#2a2d35] disabled:opacity-40"
        >
          <FontAwesomeIcon icon={faFloppyDisk} className="text-[10px]" />
          Lưu
        </button>

        <div className="min-w-0 flex-1 truncate px-2 font-mono text-[11px] text-white/45">
          {draftId ? (
            <span title={mate.draftUrl ?? undefined}>
              draft_id=<span className="text-sky-300/90">{draftId}</span>
            </span>
          ) : mate.localProject ? (
            <span title={mate.localProject}>
              Draft local đang dùng: <span className="text-emerald-300/90">{mate.localProject.split(/[/\\]/).filter(Boolean).pop()}</span>
            </span>
          ) : (
            <span className="text-amber-400/80">
              Chưa chọn draft — chọn 1 dự án bên phải hoặc bấm «Tạo draft»
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setUrlEdit(mate.baseUrl);
            setShowSettings((v) => !v);
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md text-white/50 hover:bg-white/5 hover:text-white/80"
          title="Cài đặt backend"
        >
          <FontAwesomeIcon icon={faGear} className="text-[12px]" />
        </button>
      </div>

      {showSettings && (
        <div className="flex items-center gap-2 border-t border-white/6 px-3 py-2">
          <span className="shrink-0 text-[11px] text-white/45">
            URL capcut-mate
          </span>
          <input
            value={urlEdit}
            onChange={(e) => setUrlEdit(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-[#1e2026] px-2 py-1 font-mono text-[11px] text-white/85 outline-none focus:border-sky-400/40"
            placeholder="http://localhost:30000"
          />
          <button
            type="button"
            onClick={() => {
              mate.setBaseUrl(urlEdit.trim() || "http://localhost:30000");
              toast.success("Đã lưu URL backend");
              void mate.refreshOnline();
            }}
            className="rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/85 hover:bg-white/15"
          >
            Áp dụng
          </button>
          {mate.draftUrl && (
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(mate.draftUrl!);
                toast.success("Đã copy draft_url");
              }}
              className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/60 hover:bg-white/5"
            >
              Copy draft_url
            </button>
          )}
        </div>
      )}
    </div>
  );
}
