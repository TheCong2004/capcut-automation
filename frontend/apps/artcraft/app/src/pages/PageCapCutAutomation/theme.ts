/**
 * CapCut Automation palette — color by *role*, not rainbow noise.
 *
 * - Shell stays dark neutral
 * - Each domain (footage / audio / subtitle / nav / CTA) has one signature hue
 * - Avoid stacking every hue on the same control
 */
export const cc = {
  shell: "bg-[#1a1b1f]",
  nav: "bg-[#141518]",
  panel: "bg-[#16171b]",
  surface: "bg-[#252830]",
  surfaceDeep: "bg-[#1e2026]",

  /** Active nav / primary brand accent */
  brand: {
    text: "text-sky-300",
    soft: "bg-sky-500/15 text-sky-300",
    bar: "bg-sky-400",
    ring: "ring-1 ring-sky-400/35",
    border: "border-sky-400/40",
  },

  /** Primary buttons (Apply / Generate / Export) */
  btnPrimary:
    "bg-[#2b7cff] text-white hover:bg-[#3a88ff] disabled:opacity-40",

  /** RUN FAB */
  btnRun:
    "bg-gradient-to-b from-cyan-300 to-cyan-500 text-[#0b1a1f] shadow-lg shadow-cyan-500/25 hover:brightness-110",

  /** Timeline track identities */
  track: {
    footage: {
      border: "border-teal-400/45",
      bg: "bg-teal-900/45",
      header: "bg-teal-700/55",
    },
    audio: {
      border: "border-blue-400/45",
      bg: "bg-blue-900/50",
      wave: "bg-sky-300/85",
    },
    subtitle: {
      border: "border-orange-400/35",
      bg: "bg-gradient-to-b from-orange-700/75 to-orange-950/65",
      text: "text-orange-50/95",
    },
  },

  /** Status chips */
  status: {
    synced: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    before: "bg-white/10 text-amber-400/90",
    vip: "bg-violet-600 text-white",
    beta: "bg-emerald-600 text-white",
    empty: "bg-white/10 text-white/40",
    active: "bg-sky-600 text-white",
  },

  /** Category library tabs (All / Video / Favorites) */
  tabActive: "bg-sky-500 text-white",
  tabIdle: "bg-[#2a2d35] text-white/55 hover:bg-[#32363f] hover:text-white/80",

  toggleOn: "bg-sky-400",
  toggleOff: "bg-white/15",
  accent: "accent-sky-500",
} as const;
