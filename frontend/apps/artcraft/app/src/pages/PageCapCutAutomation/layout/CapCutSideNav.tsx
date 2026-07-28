import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpFromBracket } from "@fortawesome/pro-solid-svg-icons";
import { twMerge } from "tailwind-merge";
import { SIDE_NAV } from "../constants";
import type { SideNavId } from "../types";

interface CapCutSideNavProps {
  activeId: SideNavId;
  onSelect: (id: SideNavId) => void;
}

/** Per-item accent so the nav is scannable without rainbow chaos. */
const NAV_ACCENT: Record<
  SideNavId,
  { icon: string; active: string; bar: string }
> = {
  materials: {
    icon: "text-teal-300",
    active: "bg-teal-500/15 text-teal-100",
    bar: "bg-teal-400",
  },
  "local-draft": {
    icon: "text-emerald-300",
    active: "bg-emerald-500/15 text-emerald-100",
    bar: "bg-emerald-400",
  },
  sync: {
    icon: "text-sky-300",
    active: "bg-sky-500/15 text-sky-200",
    bar: "bg-sky-400",
  },
  caption: {
    icon: "text-violet-300",
    active: "bg-violet-500/15 text-violet-200",
    bar: "bg-violet-400",
  },
  effects: {
    icon: "text-fuchsia-300",
    active: "bg-fuchsia-500/15 text-fuchsia-200",
    bar: "bg-fuchsia-400",
  },
  transitions: {
    icon: "text-indigo-300",
    active: "bg-indigo-500/15 text-indigo-200",
    bar: "bg-indigo-400",
  },
  filters: {
    icon: "text-pink-300",
    active: "bg-pink-500/15 text-pink-200",
    bar: "bg-pink-400",
  },
  stickers: {
    icon: "text-rose-300",
    active: "bg-rose-500/15 text-rose-100",
    bar: "bg-rose-400",
  },
  animations: {
    icon: "text-amber-300",
    active: "bg-amber-500/15 text-amber-100",
    bar: "bg-amber-400",
  },
  sounds: {
    icon: "text-blue-300",
    active: "bg-blue-500/15 text-blue-200",
    bar: "bg-blue-400",
  },
  adjustment: {
    icon: "text-lime-300",
    active: "bg-lime-500/15 text-lime-100",
    bar: "bg-lime-400",
  },
  media: {
    icon: "text-teal-300",
    active: "bg-teal-500/15 text-teal-100",
    bar: "bg-teal-400",
  },
  keyframe: {
    icon: "text-cyan-300",
    active: "bg-cyan-500/15 text-cyan-100",
    bar: "bg-cyan-400",
  },
  workflow: {
    icon: "text-violet-300",
    active: "bg-violet-500/15 text-violet-200",
    bar: "bg-violet-400",
  },
  "auto-render": {
    icon: "text-rose-300",
    active: "bg-rose-500/15 text-rose-100",
    bar: "bg-rose-400",
  },
  "ai-generate": {
    icon: "text-emerald-300",
    active: "bg-emerald-500/15 text-emerald-100",
    bar: "bg-emerald-400",
  },
  extension: {
    icon: "text-orange-300",
    active: "bg-orange-500/15 text-orange-100",
    bar: "bg-orange-400",
  },
};

export function CapCutSideNav({ activeId, onSelect }: CapCutSideNavProps) {
  return (
    <aside className="flex h-full min-h-0 w-full min-w-0 flex-col border-r border-white/8 bg-[#141518]">
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/5">
        <img
          src="/resources/images/services/artcraft.svg"
          alt="ArtCraft Logo"
          className="h-8 w-8 object-contain drop-shadow-[0_0_8px_rgba(0,242,254,0.6)]"
        />
        <div className="leading-tight">
          <div className="text-[14px] font-extrabold tracking-wide bg-gradient-to-r from-cyan-300 via-sky-200 to-indigo-300 bg-clip-text text-transparent">
            ARTCRAFT
          </div>
          <div className="text-[10px] font-bold tracking-widest text-cyan-400/80 uppercase">
            Tự Động Hóa AI
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-1">
        {SIDE_NAV.map((item) => {
          const active = activeId === item.id;
          const accent = NAV_ACCENT[item.id];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={twMerge(
                "relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors",
                active
                  ? accent.active
                  : "text-white/65 hover:bg-white/5 hover:text-white",
              )}
            >
              {active && (
                <span
                  className={twMerge(
                    "absolute top-1/2 left-0 h-8 w-0.5 -translate-y-1/2 rounded-r",
                    accent.bar,
                  )}
                />
              )}
              <span
                className={twMerge(
                  "flex h-7 w-7 items-center justify-center rounded-md",
                  active ? "bg-black/20" : "bg-white/5",
                  !active && accent.icon,
                )}
              >
                <FontAwesomeIcon
                  icon={item.icon}
                  className={twMerge("text-[12px]", active && accent.icon)}
                />
              </span>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.badge && (
                <span
                  className={twMerge(
                    "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                    item.badge === "Vip"
                      ? "bg-violet-600 text-white"
                      : item.badge === "Soon"
                        ? "bg-white/15 text-white/55"
                        : "bg-emerald-600 text-white",
                  )}
                >
                  {item.badge === "Soon"
                    ? "Sắp có"
                    : item.badge === "Vip"
                      ? "Vip"
                      : item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-white/8 p-3">
        <div className="rounded-xl bg-[#1e2026] p-3">
          <div className="mb-1 flex items-center justify-between text-[11px] text-white/50">
            <span>Current plan</span>
            <span aria-hidden>🇺🇸</span>
          </div>
          <div className="text-sm font-semibold">Free</div>
          <div className="mt-0.5 text-[11px] text-white/40">
            Expires: 2026-07-21
          </div>
          <button
            type="button"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#2b7cff] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#3a88ff]"
          >
            <FontAwesomeIcon icon={faArrowUpFromBracket} />
            Upgrade Plan
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2 px-1 text-[11px] text-white/55">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600/80 text-[10px] font-bold">
            T
          </div>
          <span className="truncate">you@artcraft.local</span>
        </div>
      </div>
    </aside>
  );
}
