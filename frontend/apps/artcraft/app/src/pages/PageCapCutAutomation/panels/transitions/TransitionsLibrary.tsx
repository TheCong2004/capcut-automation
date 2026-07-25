import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faStar as faStarSolid } from "@fortawesome/pro-solid-svg-icons";
import { faStar as faStarRegular } from "@fortawesome/pro-regular-svg-icons";
import { twMerge } from "tailwind-merge";
import type { TransitionItem, TransitionsCategoryId } from "../../types";

interface TransitionsLibraryProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: TransitionsCategoryId;
  onCategoryChange: (id: TransitionsCategoryId) => void;
  transitions: TransitionItem[];
  counts: { all: number; favorites: number };
  favoriteIds: Set<string>;
  onToggleFavorite: (id: string) => void;
  onAdd: (item: TransitionItem) => void;
  emptyHint?: string;
}

export function TransitionsLibrary({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  transitions,
  counts,
  favoriteIds,
  onToggleFavorite,
  onAdd,
  emptyHint,
}: TransitionsLibraryProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="px-4 pt-4 pb-2">
        <h2 className="mb-1 text-[15px] font-semibold text-white/90">
          Thư viện chuyển cảnh
        </h2>
        <p className="mb-3 text-[11px] leading-relaxed text-white/40">
          List từ BE <code className="text-white/50">/local/enums</code> · Apply
          → <code className="text-white/50">/local/transition</code>
        </p>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Tìm chuyển cảnh..."
          className="w-full rounded-lg border border-white/10 bg-[#252830] px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/35 focus:border-sky-400/40"
        />
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 pb-3">
        {(
          [
            { id: "all" as const, label: "All", count: counts.all },
            {
              id: "favorites" as const,
              label: "Favorites",
              count: counts.favorites,
              star: true,
            },
          ] as const
        ).map((tab) => {
          const active = category === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onCategoryChange(tab.id)}
              className={twMerge(
                "rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
                active
                  ? "bg-sky-500 text-white"
                  : "bg-[#2a2d35] text-white/55 hover:bg-[#32363f] hover:text-white/80",
              )}
            >
              {tab.label}
              {"star" in tab && tab.star && (
                <FontAwesomeIcon
                  icon={faStarSolid}
                  className="mx-0.5 text-[9px]"
                />
              )}{" "}
              ({tab.count})
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-white/6">
        {transitions.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-white/40">
            {emptyHint || "Không có transition từ BE / không khớp search"}
          </div>
        ) : (
          transitions.map((item) => {
            const isFav = favoriteIds.has(item.id) || !!item.favorite;
            return (
              <div
                key={item.id}
                className="group flex items-center gap-3 border-b border-white/6 px-4 py-2.5 hover:bg-white/5"
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
                  title="Add to selected"
                  onClick={() => onAdd(item)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-white/35 hover:bg-white/5 hover:text-white/80"
                >
                  <FontAwesomeIcon icon={faPlus} className="text-[13px]" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
