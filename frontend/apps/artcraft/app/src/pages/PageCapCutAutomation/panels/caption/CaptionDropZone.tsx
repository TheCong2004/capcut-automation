import { useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUpFromBracket,
  faFileLines,
  faTrash,
} from "@fortawesome/pro-solid-svg-icons";
import { twMerge } from "tailwind-merge";
import toast from "react-hot-toast";
import type { CaptionSourceTab } from "../../types";

interface CaptionDropZoneProps {
  sourceTab: CaptionSourceTab;
  onSourceTabChange: (tab: CaptionSourceTab) => void;
  onFile?: (file: File) => void;
  fileName?: string | null;
  onClearFile?: () => void;
}

/** Vùng chọn nguồn + kéo thả file — gọn, không chiếm full height (tránh đè textarea). */
export function CaptionDropZone({
  sourceTab,
  onSourceTabChange,
  onFile,
  fileName,
  onClearFile,
}: CaptionDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const isProject = sourceTab === "selected-project";

  const pickFile = () => inputRef.current?.click();

  const takeFile = (f: File | undefined) => {
    if (!f) return;
    if (onFile) onFile(f);
    else toast.success(f.name);
  };

  return (
    <div className="shrink-0 border-b border-white/8">
      <div className="flex items-center gap-1 px-3 pt-3">
        {(
          [
            { id: "external-file" as const, label: "Từ file / dán text" },
            { id: "selected-project" as const, label: "Từ dự án đã chọn" },
          ] as const
        ).map((tab) => {
          const active = sourceTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSourceTabChange(tab.id)}
              className={twMerge(
                "flex-1 rounded-full px-4 py-2 text-[12px] font-medium transition-colors",
                active
                  ? "bg-[#2a3140] text-sky-300 ring-1 ring-sky-400/35"
                  : "text-white/45 hover:bg-white/5 hover:text-white/70",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {isProject ? (
        <div className="px-4 py-4 text-center text-[12px] text-white/40">
          Chưa nối đọc scene từ panel dự án phải. Dùng tab «Từ file / dán text»
          hoặc import SRT ở Draft local.
        </div>
      ) : (
        <div className="px-4 py-3">
          <input
            ref={inputRef}
            type="file"
            accept=".srt,.vtt,.txt,text/plain"
            className="hidden"
            onChange={(e) => {
              takeFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") pickFile();
            }}
            onClick={pickFile}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              takeFile(e.dataTransfer.files?.[0]);
            }}
            className={twMerge(
              "flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3 transition-colors",
              dragOver
                ? "border-sky-400/50 bg-sky-500/10"
                : "border-white/12 bg-[#1c1e24] hover:border-white/20 hover:bg-[#22252c]",
            )}
          >
            <FontAwesomeIcon
              icon={faArrowUpFromBracket}
              className="text-xl text-white/45"
            />
            <div className="min-w-0 flex-1 text-left">
              <p className="text-[13px] text-white/80">
                Kéo thả file .srt / .txt hoặc bấm để chọn
              </p>
              <p className="mt-0.5 text-[11px] text-white/35">
                Nội dung sẽ hiện ở ô SRT bên dưới — có thể sửa tay trước khi Áp
                dụng
              </p>
            </div>
          </div>

          {fileName ? (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/8 bg-[#16171b] px-3 py-2">
              <FontAwesomeIcon
                icon={faFileLines}
                className="text-[12px] text-violet-300/80"
              />
              <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-white/75">
                {fileName}
              </span>
              <button
                type="button"
                title="Bỏ file"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearFile?.();
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md text-white/40 hover:bg-white/5 hover:text-white/70"
              >
                <FontAwesomeIcon icon={faTrash} className="text-[11px]" />
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
