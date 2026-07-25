import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowDownToLine,
  faArrowUpFromBracket,
  faPlus,
  faXmark,
} from "@fortawesome/pro-solid-svg-icons";
import type { LutItem } from "../../types";

interface LutLibraryProps {
  search: string;
  onSearchChange: (value: string) => void;
  luts: LutItem[];
  selectedIds: Set<string>;
  onAdd: (item: LutItem) => void;
  onRemove: (id: string) => void;
  onDownloadLibrary: () => void;
  onImport: () => void;
}

export function LutLibrary({
  search,
  onSearchChange,
  luts,
  selectedIds,
  onAdd,
  onRemove,
  onDownloadLibrary,
  onImport,
}: LutLibraryProps) {
  const q = search.trim().toLowerCase();
  const filtered = q
    ? luts.filter((l) => l.name.toLowerCase().includes(q))
    : luts;
  const empty = filtered.length === 0;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#1a1b1f]">
      <div className="px-4 pt-4 pb-2">
        <h2 className="mb-3 text-[15px] font-semibold text-white/90">
          LUT Library
        </h2>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search for LUTs..."
          className="w-full rounded-lg border border-white/10 bg-[#252830] px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/35 focus:border-sky-400/40"
        />
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto border-t border-white/6">
        {empty ? (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-8 text-center">
            <p className="text-[15px] font-semibold text-white/85">
              No LUTs found
            </p>
            <p className="mt-2 max-w-sm text-[12px] leading-relaxed text-white/40">
              Download the starter LUT library, or import your own .cube, .3dl,
              or .lut files.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={onDownloadLibrary}
                className="flex items-center gap-2 rounded-lg bg-[#2b7cff] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#3a88ff]"
              >
                <FontAwesomeIcon icon={faArrowDownToLine} />
                Download LUT Library
              </button>
              <button
                type="button"
                onClick={onImport}
                className="flex items-center gap-2 rounded-lg border border-white/12 bg-[#252830] px-4 py-2.5 text-[13px] font-medium text-white/75 hover:bg-[#2a2d35] hover:text-white"
              >
                <FontAwesomeIcon icon={faArrowUpFromBracket} />
                Import LUT...
              </button>
            </div>
            <p className="mt-4 text-[11px] text-white/30">
              Download or import LUT files to populate this library.
            </p>
          </div>
        ) : (
          filtered.map((item) => {
            const isSelected = selectedIds.has(item.id);
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 border-b border-white/6 px-4 py-2.5 hover:bg-white/[0.04]"
              >
                <div
                  className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-white/10"
                  style={{ background: item.thumb }}
                />
                <div className="min-w-0 flex-1 truncate text-[13px] text-white/90">
                  {item.name}
                </div>
                <button
                  type="button"
                  title={isSelected ? "Remove" : "Add"}
                  onClick={() =>
                    isSelected ? onRemove(item.id) : onAdd(item)
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-md text-white/40 hover:bg-white/5 hover:text-white/80"
                >
                  <FontAwesomeIcon
                    icon={isSelected ? faXmark : faPlus}
                    className="text-[13px]"
                  />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Always-available import strip when library has items */}
      {!empty && (
        <div className="flex items-center gap-2 border-t border-white/8 px-4 py-2.5">
          <button
            type="button"
            onClick={onDownloadLibrary}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] text-white/70 hover:bg-white/5"
          >
            <FontAwesomeIcon icon={faArrowDownToLine} />
            Download library
          </button>
          <button
            type="button"
            onClick={onImport}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] text-white/50 hover:bg-white/5 hover:text-white/80"
          >
            <FontAwesomeIcon icon={faArrowUpFromBracket} />
            Import LUT...
          </button>
        </div>
      )}
    </div>
  );
}
