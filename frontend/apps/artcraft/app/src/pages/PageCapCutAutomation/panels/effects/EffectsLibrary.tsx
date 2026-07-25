import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faStar as faStarSolid,
} from "@fortawesome/pro-solid-svg-icons";
import { faStar as faStarRegular } from "@fortawesome/pro-regular-svg-icons";
import { twMerge } from "tailwind-merge";
import type { EffectItem, EffectsCategoryId } from "../../types";

interface EffectsLibraryProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: EffectsCategoryId;
  onCategoryChange: (id: EffectsCategoryId) => void;
  effects: EffectItem[];
  /** Counts from BE-loaded library (không mock) */
  counts: { all: number; video: number; body: number; favorites: number };
  favoriteIds: Set<string>;
  onToggleFavorite: (id: string) => void;
  onAdd: (effect: EffectItem) => void;
  emptyHint?: string;
}

const CATEGORIES: {
  id: EffectsCategoryId;
  label: string;
  star?: boolean;
}[] = [
  { id: "all", label: "All" },
  { id: "video", label: "Video" },
  { id: "body", label: "Body" },
  { id: "favorites", label: "Favorites", star: true },
];

export function EffectsLibrary({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  effects,
  counts,
  favoriteIds,
  onToggleFavorite,
  onAdd,
  emptyHint,
}: EffectsLibraryProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="px-4 pt-4 pb-2">
        <h2 className="mb-3 text-[15px] font-semibold text-white/90">
          Effects Library
        </h2>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search for effects..."
          className="w-full rounded-lg border border-white/10 bg-[#252830] px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/35 focus:border-sky-400/40"
        />
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 pb-3">
        {CATEGORIES.map((tab) => {
          const active = category === tab.id;
          const count =
            tab.id === "all"
              ? counts.all
              : tab.id === "video"
                ? counts.video
                : tab.id === "body"
                  ? counts.body
                  : counts.favorites;
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
              {tab.star && (
                <FontAwesomeIcon
                  icon={faStarSolid}
                  className="mx-0.5 text-[9px]"
                />
              )}{" "}
              ({count})
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-white/6">
        {effects.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-white/40">
            {emptyHint || "Không có dữ liệu từ BE / không khớp tìm kiếm."}
          </div>
        ) : (
          effects.map((effect) => {
            const isFav = favoriteIds.has(effect.id) || !!effect.favorite;
            return (
              <div
                key={effect.id}
                className="group flex items-center gap-3 border-b border-white/6 px-4 py-2.5 hover:bg-white/5"
              >
                <div
                  className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-white/10"
                  style={{ background: effect.thumb }}
                />
                <div className="min-w-0 flex-1 truncate text-[13px] text-white/90">
                  {effect.name}
                </div>
                <button
                  type="button"
                  title={isFav ? "Unfavorite" : "Favorite"}
                  onClick={() => onToggleFavorite(effect.id)}
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
                  onClick={() => onAdd(effect)}
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
