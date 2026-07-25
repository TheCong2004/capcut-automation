import type { AnimationItem } from "../../types";

export const ANIMATIONS_LIBRARY: AnimationItem[] = [
  // In
  {
    id: "in-fade",
    name: "Soft Fade In",
    category: "in",
    thumb: "linear-gradient(135deg,#3a3f4a,#4a5160)",
  },
  {
    id: "in-zoom",
    name: "Zoom In",
    category: "in",
    thumb: "linear-gradient(135deg,#2d3139,#5a6270)",
  },
  {
    id: "in-slide",
    name: "Slide Up In",
    category: "in",
    thumb: "linear-gradient(135deg,#363b45,#484f5c)",
  },
  // Out (as in screenshot)
  {
    id: "out-100-gates",
    name: "100 Gates-shut",
    category: "out",
    thumb: "linear-gradient(135deg,#3a3f4a,#4a5160)",
  },
  {
    id: "out-2025",
    name: "2025",
    category: "out",
    thumb: "linear-gradient(135deg,#2d3139,#5a6270)",
  },
  {
    id: "out-2x-beam",
    name: "2x Beam-Out",
    category: "out",
    thumb: "linear-gradient(135deg,#363b45,#484f5c)",
  },
  {
    id: "out-3-part",
    name: "3-part Reveal",
    category: "out",
    thumb: "linear-gradient(135deg,#3a3f4a,#4a5160)",
  },
  {
    id: "out-360-wipe",
    name: "360 Wipe-Out",
    category: "out",
    thumb: "linear-gradient(135deg,#2d3139,#5a6270)",
  },
  {
    id: "out-3d-page",
    name: "3D Page Turn",
    category: "out",
    thumb: "linear-gradient(135deg,#363b45,#484f5c)",
  },
  {
    id: "out-4-arrows",
    name: "4 Arrows Out",
    category: "out",
    thumb: "linear-gradient(135deg,#3a3f4a,#4a5160)",
  },
  {
    id: "out-4-cut",
    name: "4-cut Out",
    category: "out",
    thumb: "linear-gradient(135deg,#2d3139,#5a6270)",
  },
  {
    id: "out-90s-fisheye",
    name: "90s Fisheye",
    category: "out",
    thumb: "linear-gradient(135deg,#363b45,#484f5c)",
  },
  {
    id: "out-abstract-office",
    name: "Abstract Office",
    category: "out",
    thumb: "linear-gradient(135deg,#3a3f4a,#4a5160)",
  },
  {
    id: "out-adjust-volume",
    name: "Adjust Volume",
    category: "out",
    thumb: "linear-gradient(135deg,#2d3139,#5a6270)",
  },
  // Combo
  {
    id: "combo-in-out-soft",
    name: "Soft In → Soft Out",
    category: "combo",
    thumb: "linear-gradient(135deg,#363b45,#484f5c)",
    favorite: true,
  },
  {
    id: "combo-zoom-pair",
    name: "Zoom In / Zoom Out",
    category: "combo",
    thumb: "linear-gradient(135deg,#3a3f4a,#4a5160)",
  },
];

export const ANIMATIONS_COUNTS = {
  in: 2134,
  out: 1009,
  combo: 420,
} as const;
