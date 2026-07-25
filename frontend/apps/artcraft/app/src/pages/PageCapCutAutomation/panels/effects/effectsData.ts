import type { EffectItem } from "../../types";

/** Demo library — UI preview only. */
export const EFFECTS_LIBRARY: EffectItem[] = [
  { id: "1998", name: "1998", category: "video", thumb: "linear-gradient(135deg,#5b7cfa,#a78bfa)" },
  { id: "2-tone-shine", name: "2-tone Shine", category: "body", thumb: "linear-gradient(135deg,#f472b6,#fbbf24)" },
  { id: "2026-bush", name: "2026 Bush", category: "video", thumb: "linear-gradient(135deg,#22c55e,#86efac)" },
  { id: "2026-fireworks", name: "2026 Fireworks", category: "video", thumb: "linear-gradient(135deg,#ef4444,#f97316)" },
  { id: "2026-quadrants", name: "2026 Quadrants", category: "video", thumb: "linear-gradient(135deg,#06b6d4,#3b82f6,#a855f7,#ec4899)" },
  { id: "2026-rollup", name: "2026 Rollup", category: "body", thumb: "linear-gradient(135deg,#f43f5e,#fb7185)" },
  { id: "29-unfold", name: "29 Unfold Effect", category: "video", thumb: "linear-gradient(135deg,#111827,#e5e7eb)" },
  { id: "2d-carousel", name: "2D Carousel", category: "video", thumb: "linear-gradient(135deg,#60a5fa,#c4b5fd)" },
  { id: "3-bars", name: "3 Bars", category: "body", thumb: "linear-gradient(135deg,#ec4899,#f9a8d4)" },
  { id: "3-slices", name: "3 Slices", category: "video", thumb: "linear-gradient(135deg,#0f172a,#38bdf8)" },
  { id: "3-step-zoom", name: "3 Step Zoom", category: "video", thumb: "linear-gradient(135deg,#1e3a8a,#93c5fd)", favorite: true },
  { id: "glitch-pop", name: "Glitch Pop", category: "video", thumb: "linear-gradient(135deg,#a3e635,#f472b6)" },
  { id: "soft-glow", name: "Soft Glow Body", category: "body", thumb: "linear-gradient(135deg,#fde68a,#fca5a5)", favorite: true },
  { id: "film-grain", name: "Film Grain", category: "video", thumb: "linear-gradient(135deg,#44403c,#a8a29e)" },
];

export const EFFECTS_COUNTS = {
  all: 3579,
  video: 3266,
  body: 313,
  favorites: 34,
} as const;