import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileImport,
  faPlus,
  faXmark,
} from "@fortawesome/pro-solid-svg-icons";
import type { KeyframeTemplate } from "../../types";

interface KeyframeLibraryProps {
  search: string;
  onSearchChange: (v: string) => void;
  templates: KeyframeTemplate[];
  selectedIds: Set<string>;
  onImport: () => void;
  onAdd: (t: KeyframeTemplate) => void;
  onRemove: (id: string) => void;
}

export function KeyframeLibrary({
  search,
  onSearchChange,
  templates,
  selectedIds,
  onImport,
  onAdd,
  onRemove,
}: KeyframeLibraryProps) {
  const q = search.trim().toLowerCase();
  const filtered = q
    ? templates.filter((t) => t.name.toLowerCase().includes(q))
    : templates;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
        <h2 className="text-[15px] font-semibold text-white/90">
          Keyframe Template
        </h2>
        <button
          type="button"
          onClick={onImport}
          className="flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#252830] px-3 py-1.5 text-[12px] font-medium text-white/70 hover:bg-[#2a2d35] hover:text-white"
        >
          <FontAwesomeIcon icon={faFileImport} className="text-[11px]" />
          Import Template
        </button>
      </div>

      <div className="px-4 pb-3">
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search for template..."
          className="w-full rounded-lg border border-white/10 bg-[#252830] px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/35 focus:border-sky-400/40"
        />
      </div>

      <div className="min-h-[120px] flex-1 overflow-y-auto border-t border-white/6">
        {filtered.length === 0 ? (
          <div className="flex h-full min-h-[120px] items-center justify-center px-4 text-center text-[12px] text-white/30">
            {templates.length === 0
              ? "No templates yet. Save or import one."
              : "No templates match your search."}
          </div>
        ) : (
          filtered.map((t) => {
            const active = selectedIds.has(t.id);
            return (
              <div
                key={t.id}
                className="flex items-center gap-3 border-b border-white/6 px-4 py-2.5 hover:bg-white/[0.04]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/10 text-[11px] font-bold text-white/80">
                  KF
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] text-white/90">
                    {t.name}
                  </div>
                  <div className="text-[10px] text-white/35">
                    {t.scaleW}% · {t.rotate.toFixed(1)}°
                  </div>
                </div>
                <button
                  type="button"
                  title={active ? "Remove" : "Add"}
                  onClick={() => (active ? onRemove(t.id) : onAdd(t))}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-white/40 hover:bg-white/5 hover:text-white/80"
                >
                  <FontAwesomeIcon
                    icon={active ? faXmark : faPlus}
                    className="text-[13px]"
                  />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
