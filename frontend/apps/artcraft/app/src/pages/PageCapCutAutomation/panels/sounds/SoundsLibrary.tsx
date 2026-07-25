import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUpFromBracket,
  faBars,
  faChevronRight,
  faPause,
  faPlay,
  faPlus,
  faStar as faStarSolid,
} from "@fortawesome/pro-solid-svg-icons";
import { faStar as faStarRegular } from "@fortawesome/pro-regular-svg-icons";
import { twMerge } from "tailwind-merge";
import toast from "react-hot-toast";
import type { SoundItem, SoundsCategoryId } from "../../types";

interface SoundsLibraryProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: SoundsCategoryId;
  onCategoryChange: (id: SoundsCategoryId) => void;
  sounds: SoundItem[];
  counts: Record<SoundsCategoryId, number>;
  favoriteIds: Set<string>;
  playingId: string | null;
  onToggleFavorite: (id: string) => void;
  onTogglePlay: (id: string) => void;
  onAdd: (item: SoundItem) => void;
  /** Chọn file/path audio thật (không mock) */
  onPickAudio?: () => void;
  emptyHint?: string;
}

export function SoundsLibrary({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  sounds,
  counts,
  favoriteIds,
  playingId,
  onToggleFavorite,
  onTogglePlay,
  onAdd,
  onPickAudio,
  emptyHint,
}: SoundsLibraryProps) {
  const tabs: { id: SoundsCategoryId; label: string; count: number }[] = [
    { id: "music", label: "Music", count: counts.music },
    {
      id: "sound-effects",
      label: "Sound Effects",
      count: counts["sound-effects"],
    },
    { id: "my-audio", label: "My Audio", count: counts["my-audio"] },
  ];

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#1a1b1f]">
      <div className="px-4 pt-4 pb-2">
        <h2 className="mb-3 text-[15px] font-semibold text-white/90">
          Sound Library
        </h2>
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search for sounds..."
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#252830] px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/35 focus:border-sky-400/40"
          />
          <button
            type="button"
            title="Path / URL audio (BE add_audios / add-audio)"
            onClick={() => {
              if (onPickAudio) onPickAudio();
              else toast.error("Chưa gắn onPickAudio");
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#252830] text-white/50 hover:bg-[#2a2d35] hover:text-white/80"
          >
            <FontAwesomeIcon icon={faArrowUpFromBracket} className="text-[12px]" />
          </button>
          <button
            type="button"
            title="Sort / filter"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#252830] text-white/50 hover:bg-[#2a2d35] hover:text-white/80"
          >
            <FontAwesomeIcon icon={faBars} className="text-[12px]" />
          </button>
        </div>
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
          title="More"
        >
          <FontAwesomeIcon icon={faChevronRight} className="text-[10px]" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-white/6">
        {sounds.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-white/40">
            {emptyHint ||
              (category === "my-audio"
                ? "My audio: dán path/URL rồi Apply (không list mock)."
                : "Không có dữ liệu BE / không khớp search")}
          </div>
        ) : (
          sounds.map((item) => {
            const isFav = favoriteIds.has(item.id) || !!item.favorite;
            const isPlaying = playingId === item.id;
            return (
              <div
                key={item.id}
                className="group flex items-center gap-2.5 border-b border-white/6 px-3 py-2.5 hover:bg-white/[0.04]"
              >
                <div
                  className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-white/10"
                  style={{ background: item.thumb }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] text-white/90">
                    {item.name}
                  </div>
                </div>
                <div className="w-12 shrink-0 text-right font-mono text-[11px] text-white/45">
                  {item.durationLabel}
                </div>
                <button
                  type="button"
                  title={isPlaying ? "Pause" : "Play preview"}
                  onClick={() => onTogglePlay(item.id)}
                  className={twMerge(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
                    isPlaying
                      ? "bg-white/10 text-white/80"
                      : "text-white/40 hover:bg-white/5 hover:text-white/80",
                  )}
                >
                  <FontAwesomeIcon
                    icon={isPlaying ? faPause : faPlay}
                    className="text-[11px]"
                  />
                </button>
                <button
                  type="button"
                  title={isFav ? "Unfavorite" : "Favorite"}
                  onClick={() => onToggleFavorite(item.id)}
                  className={twMerge(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors",
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
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/35 hover:bg-white/5 hover:text-white/80"
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
