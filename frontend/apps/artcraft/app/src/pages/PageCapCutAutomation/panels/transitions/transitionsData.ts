import type { TransitionItem } from "../../types";

export const TRANSITIONS_LIBRARY: TransitionItem[] = [
  { id: "1029-lumi", name: "1029-Lumi-????", thumb: "linear-gradient(135deg,#93c5fd,#e0e7ff)" },
  { id: "180-flip-flash", name: "180 Flip-Flash", thumb: "linear-gradient(135deg,#64748b,#94a3b8)" },
  { id: "180-opening", name: "180 Opening", thumb: "linear-gradient(135deg,#f8fafc,#cbd5e1)" },
  { id: "180-swipe", name: "180 Swipe", thumb: "linear-gradient(135deg,#0ea5e9,#38bdf8)" },
  { id: "180-turn", name: "180 Turn", thumb: "linear-gradient(135deg,#22c55e,#86efac)" },
  { id: "180-turn-2", name: "180 Turn 2", thumb: "linear-gradient(135deg,#14b8a6,#5eead4)" },
  { id: "180-wipe", name: "180 Wipe", thumb: "linear-gradient(135deg,#f97316,#fdba74)" },
  { id: "2-panel-merge", name: "2-panel Merge", thumb: "linear-gradient(135deg,#a3e635,#4ade80)" },
  { id: "2026-game", name: "2026 Game", thumb: "linear-gradient(135deg,#6b7280,#9ca3af)" },
  { id: "2x-pic-flip", name: "2x Pic Flip", thumb: "linear-gradient(135deg,#e0f2fe,#7dd3fc)" },
  { id: "3-column-scroll", name: "3-Column Scroll", thumb: "linear-gradient(135deg,#c4b5fd,#a78bfa)" },
  { id: "zoom-blur", name: "Zoom Blur", thumb: "linear-gradient(135deg,#1e293b,#64748b)", favorite: true },
  { id: "soft-dissolve", name: "Soft Dissolve", thumb: "linear-gradient(135deg,#fce7f3,#f9a8d4)", favorite: true },
];

export const TRANSITIONS_COUNTS = { all: 2104, favorites: 4 } as const;