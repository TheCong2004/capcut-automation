import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronRight,
  faMinus,
  faPlus,
  faStar as faStarSolid,
} from "@fortawesome/pro-solid-svg-icons";
import { faStar as faStarRegular } from "@fortawesome/pro-regular-svg-icons";
import { twMerge } from "tailwind-merge";
import type { AnimationItem, AnimationsCategoryId } from "../../types";

interface AnimationsLibraryProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: AnimationsCategoryId;
  onCategoryChange: (id: AnimationsCategoryId) => void;
  animations: AnimationItem[];
  counts: { in: number; out: number; combo: number };
  favoriteIds: Set<string>;
  selectedIds: Set<string>;
  onToggleFavorite: (id: string) => void;
  onAdd: (item: AnimationItem) => void;
  onRemove: (id: string) => void;
  emptyHint?: string;
}

export function AnimationsLibrary({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  animations,
  counts,
  favoriteIds,
  selectedIds,
  onToggleFavorite,
  onAdd,
  onRemove,
  emptyHint,
}: AnimationsLibraryProps) {
  const tabs: { id: AnimationsCategoryId; label: string; count: number }[] = [
    { id: "in", label: "In", count: counts.in },
    { id: "out", label: "Out", count: counts.out },
    { id: "combo", label: "Combo", count: counts.combo },
  ];

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#1a1b1f]">
      <div className="px-4 pt-4 pb-2">
        <h2 className="mb-3 text-[15px] font-semibold text-white/90">
          Animations Library
        </h2>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search for animations..."
          className="w-full rounded-lg border border-white/10 bg-[#252830] px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/35 focus:border-sky-400/40"
        />
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3">
        {tabs.map((tab) => {
          const active = category === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onCategoryChange(tab.id)}
              className={twMerge(
                "shrink-0 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
                active
                  ? "bg-sky-500 text-white"
                  : "bg-[#2a2d35] text-white/55 hover:bg-[#32363f] hover:text-white/80",
              )}
            >
              {tab.label} ({tab.count})
            </button>
          );
        })}
        <button
          type="button"
          className="flex h-8 w-7 shrink-0 items-center justify-center rounded-md bg-[#2a2d35] text-white/40 hover:text-white/70"
          title="More categories"
        >
          <FontAwesomeIcon icon={faChevronRight} className="text-[10px]" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-white/6">
        {animations.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-white/40">
            {emptyHint || "Không có animation từ BE / không khớp search"}
          </div>
        ) : (
          animations.map((item) => {
            const isFav = favoriteIds.has(item.id) || !!item.favorite;
            const isSelected = selectedIds.has(item.id);
            return (
              <div
                key={item.id}
                className={twMerge(
                  "group flex items-center gap-3 border-b border-white/6 px-4 py-2.5 hover:bg-white/[0.04]",
                  isSelected && "bg-white/[0.03]",
                )}
              >
                <div
                  className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 shadow-sm"
                  style={{ background: item.thumb }}
                  title="BE không có thumbnail animation — màu placeholder theo tên"
                >
                  <span className="max-w-full truncate px-0.5 text-center text-[9px] font-bold text-white/85 drop-shadow">
                    {item.name.slice(0, 2)}
                  </span>
                </div>
                <div className="min-w-0 flex-1 truncate text-[13px] text-white/90">
                  {item.name}
                </div>
                <button
                  type="button"
                  title={isFav ? "Unfavorite" : "Favorite"}
                  onClick={() => onToggleFavorite(item.id)}
                  className={twMerge(
                    "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                    isFav
                      ? "text-amber-400 hover:bg-white/5" : "text-white/30 hover:bg-white/5 hover:text-white/60",
                  )}
                >
                  <FontAwesomeIcon
                    icon={isFav ? faStarSolid : faStarRegular}
                    className="text-[13px]"
                  />
                </button>
                <button
                  type="button"
                  title={isSelected ? "Remove from selected" : "Add to selected"}
                  onClick={() =>
                    isSelected ? onRemove(item.id) : onAdd(item)
                  }
                  className={twMerge(
                    "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                    isSelected
                      ? "text-white/55 hover:bg-white/5 hover:text-white/60"
                      : "text-white/35 hover:bg-white/5 hover:text-white/80",
                  )}
                >
                  <FontAwesomeIcon
                    icon={isSelected ? faMinus : faPlus}
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
