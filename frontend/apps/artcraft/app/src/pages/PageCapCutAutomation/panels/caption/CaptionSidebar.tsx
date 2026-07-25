import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRotateLeft,
  faArrowRotateRight,
  faClosedCaptioning,
  faEyeSlash,
  faFont,
  faKey,
  faMagnifyingGlass,
  faPersonRunning,
  faRotateLeft,
  faUpload,
} from "@fortawesome/pro-solid-svg-icons";
import { twMerge } from "tailwind-merge";
import toast from "react-hot-toast";

type CaptionEditorTab = "captions" | "text" | "animation";

interface CaptionSidebarProps {
  charsPerLine: number;
  maxLines: number;
  onCharsPerLineChange: (v: number) => void;
  onMaxLinesChange: (v: number) => void;
  onApply: () => void;
  /** Export SRT qua BE local hoặc tải text hiện có — không mock */
  onExport?: () => void;
  exporting?: boolean;
  applying?: boolean;
}

const EDITOR_TABS: {
  id: CaptionEditorTab;
  label: string;
  icon: typeof faFont;
}[] = [
  { id: "captions", label: "Captions", icon: faClosedCaptioning },
  { id: "text", label: "Text", icon: faFont },
  { id: "animation", label: "Animation", icon: faPersonRunning },
];

export function CaptionSidebar({
  charsPerLine,
  maxLines,
  onCharsPerLineChange,
  onMaxLinesChange,
  onApply,
  onExport,
  exporting = false,
  applying = false,
}: CaptionSidebarProps) {
  const [editorTab, setEditorTab] = useState<CaptionEditorTab>("captions");
  const [topSlider, setTopSlider] = useState(50);

  return (
    <aside className="flex h-full min-h-0 w-full min-w-0 flex-col border-l border-white/8 bg-[#16171b]">
      {/* Header: Captions / Text / Animation + Export */}
      <div className="flex items-center justify-between gap-2 border-b border-white/8 px-2 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {EDITOR_TABS.map((tab) => {
            const active = editorTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setEditorTab(tab.id)}
                className={twMerge(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                  active
                    ? "bg-white/10 text-white/80"
                    : "text-white/45 hover:bg-white/5 hover:text-white/75",
                )}
              >
                <FontAwesomeIcon icon={tab.icon} className="text-[11px]" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          disabled={exporting}
          onClick={() => {
            if (onExport) onExport();
            else toast.error("Chưa gắn export");
          }}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#2b7cff] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#3a88ff] disabled:opacity-50"
        >
          <FontAwesomeIcon icon={faUpload} className="text-[11px]" />
          {exporting ? "…" : "Export"}
        </button>
      </div>

      {/* Tools — undo/redo BE chưa có; không toast mock giả thành công */}
      <div className="flex items-center gap-1 border-b border-white/8 px-3 py-2 text-white/45">
        <ToolBtn
          icon={faArrowRotateLeft}
          title="Undo — BE chưa hỗ trợ"
          onClick={() => toast("Undo: BE chưa có API history")}
        />
        <ToolBtn
          icon={faArrowRotateRight}
          title="Redo — BE chưa hỗ trợ"
          onClick={() => toast("Redo: BE chưa có API history")}
        />
        <ToolBtn icon={faKey} title="Key" />
        <ToolBtn icon={faFont} title="Font" />
        <ToolBtn icon={faEyeSlash} title="Hide" />
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#1e2026] px-2.5 py-1.5">
          <input
            type="text"
            placeholder="Find"
            className="min-w-0 flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-white/30"
          />
          <FontAwesomeIcon
            icon={faMagnifyingGlass}
            className="text-[11px] text-white/35"
          />
        </div>
      </div>

      {/* Body by editor tab */}
      {editorTab === "captions" && (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-3">
            <div className="grid grid-cols-[36px_1fr] overflow-hidden rounded-t-md border border-white/10 bg-[#1c1e24] text-[11px] text-white/45">
              <div className="border-r border-white/10 px-2 py-1.5 text-center">
                #
              </div>
              <div className="px-2 py-1.5">Text</div>
            </div>
            <div className="min-h-[100px] rounded-b-md border border-t-0 border-white/10 bg-[#141518]" />
          </div>

          <div className="space-y-4 border-t border-white/8 px-4 py-4">
            <SliderRow
              label=""
              value={topSlider}
              min={0}
              max={100}
              unit="m"
              onChange={setTopSlider}
              showLabel={false}
            />
            <SliderRow
              label="Characters/Line"
              value={charsPerLine}
              min={10}
              max={80}
              onChange={onCharsPerLineChange}
            />
            <SliderRow
              label="Max lines/Segment"
              value={maxLines}
              min={1}
              max={5}
              onChange={onMaxLinesChange}
            />

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md text-white/45 hover:bg-white/5 hover:text-white/80"
                title="Reset"
              >
                <FontAwesomeIcon icon={faRotateLeft} />
              </button>
              <button
                type="button"
                onClick={onApply}
                disabled={applying}
                className="rounded-lg bg-[#2b7cff] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#3a88ff] disabled:opacity-50"
              >
                {applying ? "Đang áp dụng…" : "Áp dụng vào draft"}
              </button>
            </div>
          </div>
        </>
      )}

      {editorTab === "text" && (
        <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
          <div className="space-y-3">
            <Field label="Font family">
              <select className="w-full rounded-lg border border-white/10 bg-[#252830] px-3 py-2 text-[12px] text-white/80 outline-none">
                <option>System Default</option>
                <option>Arial</option>
                <option>Roboto</option>
                <option>Noto Sans</option>
              </select>
            </Field>
            <Field label="Font size">
              <input
                type="number"
                defaultValue={48}
                className="w-full rounded-lg border border-white/10 bg-[#252830] px-3 py-2 text-[12px] text-white outline-none"
              />
            </Field>
            <Field label="Color">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  defaultValue="#ffffff"
                  className="h-9 w-12 cursor-pointer rounded border border-white/10 bg-transparent"
                />
                <span className="text-[12px] text-white/50">#FFFFFF</span>
              </div>
            </Field>
            <Field label="Alignment">
              <div className="flex gap-1">
                {["Left", "Center", "Right"].map((a) => (
                  <button
                    key={a}
                    type="button"
                    className="flex-1 rounded-md bg-[#252830] py-1.5 text-[11px] text-white/60 hover:bg-[#2a2d35] hover:text-white"
                  >
                    {a}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <div className="mt-auto flex justify-end pt-4">
            <button
              type="button"
              onClick={onApply}
              disabled={applying}
              className="rounded-lg bg-[#2b7cff] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#3a88ff] disabled:opacity-50"
            >
              {applying ? "Đang áp dụng…" : "Áp dụng vào draft"}
            </button>
          </div>
        </div>
      )}

      {editorTab === "animation" && (
        <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
          <div className="space-y-3">
            <Field label="In animation">
              <select className="w-full rounded-lg border border-white/10 bg-[#252830] px-3 py-2 text-[12px] text-white/80 outline-none">
                <option>None</option>
                <option>Fade In</option>
                <option>Typewriter</option>
                <option>Pop</option>
                <option>Slide Up</option>
              </select>
            </Field>
            <Field label="Out animation">
              <select className="w-full rounded-lg border border-white/10 bg-[#252830] px-3 py-2 text-[12px] text-white/80 outline-none">
                <option>None</option>
                <option>Fade Out</option>
                <option>Pop Out</option>
                <option>Slide Down</option>
              </select>
            </Field>
            <Field label="Duration (s)">
              <input
                type="number"
                defaultValue={0.3}
                step={0.1}
                min={0}
                className="w-full rounded-lg border border-white/10 bg-[#252830] px-3 py-2 text-[12px] text-white outline-none"
              />
            </Field>
          </div>
          <div className="mt-auto flex justify-end pt-4">
            <button
              type="button"
              onClick={onApply}
              disabled={applying}
              className="rounded-lg bg-[#2b7cff] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#3a88ff] disabled:opacity-50"
            >
              {applying ? "Đang áp dụng…" : "Áp dụng vào draft"}
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[12px] text-white/55">{label}</div>
      {children}
    </div>
  );
}

function ToolBtn({
  icon,
  title,
  onClick,
}: {
  icon: typeof faFont;
  title: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/5 hover:text-white/80"
    >
      <FontAwesomeIcon icon={icon} className="text-[12px]" />
    </button>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  unit,
  onChange,
  showLabel = true,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (v: number) => void;
  showLabel?: boolean;
}) {
  return (
    <div>
      {showLabel && label && (
        <div className="mb-1.5 text-[12px] text-white/70">{label}</div>
      )}
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-sky-500"
        />
        <div className="flex w-14 items-center justify-end gap-0.5 rounded-md border border-white/10 bg-[#1e2026] px-1.5 py-1 text-[11px] text-white/70">
          <span>{value}</span>
          {unit && <span className="text-white/40">{unit}</span>}
        </div>
      </div>
    </div>
  );
}
