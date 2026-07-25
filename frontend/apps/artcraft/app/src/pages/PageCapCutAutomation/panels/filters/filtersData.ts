import type { FilterItem } from "../../types";

export const FILTERS_LIBRARY: FilterItem[] = [
  { id: "1968", name: "1968", thumb: "linear-gradient(135deg,#c4a574,#8b5a2b)" },
  { id: "1978", name: "1978", thumb: "linear-gradient(135deg,#fbbf24,#78350f)" },
  { id: "1980", name: "1980", thumb: "linear-gradient(135deg,#a8a29e,#57534e)" },
  { id: "1988", name: "1988", thumb: "linear-gradient(135deg,#7c3aed,#c4b5fd)" },
  { id: "1998", name: "1998", thumb: "linear-gradient(135deg,#1e3a8a,#93c5fd)" },
  { id: "2077", name: "2077", thumb: "linear-gradient(135deg,#0f172a,#22d3ee)" },
  { id: "4k", name: "4K", thumb: "linear-gradient(135deg,#38bdf8,#e0f2fe)" },
  { id: "80s-holiday", name: "80s Holiday", thumb: "linear-gradient(135deg,#f472b6,#fde68a)" },
  { id: "80s-hongkong", name: "80s Hongkong", thumb: "linear-gradient(135deg,#f97316,#fbbf24)" },
  { id: "8k", name: "8K", thumb: "linear-gradient(135deg,#64748b,#e2e8f0)" },
  { id: "90s-2", name: "90s 2", thumb: "linear-gradient(135deg,#dc2626,#fca5a5)" },
  { id: "cinema-teal", name: "Cinema Teal", thumb: "linear-gradient(135deg,#0f766e,#99f6e4)", favorite: true },
];

export const FILTERS_COUNTS = { all: 841, favorites: 0 } as const;