import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRotateLeft,
  faArrowRotateRight,
  faBars,
  faChevronDown,
  faCircle,
  faHeart,
  faMagnifyingGlassMinus,
  faMagnifyingGlassPlus,
  faPen,
  faPlus,
  faSquare,
  faStar,
  faTableColumns,
  faTableRows,
  faT,
} from "@fortawesome/pro-solid-svg-icons";
import { twMerge } from "tailwind-merge";
import type { MediaMaskLayer, MediaMaskType } from "../../types";

export interface MediaMaskState {
  layers: MediaMaskLayer[];
  activeLayerId: string;
  maskType: MediaMaskType;
  reverseMask: boolean;
  posX: number;
  posY: number;
  rotation: number;
  size: number;
  feather: number;
  frameRatio: string;
  zoom: number;
}

interface MediaMaskPanelProps {
  state: MediaMaskState;
  onChange: (patch: Partial<MediaMaskState>) => void;
  onAddLayer: () => void;
}

const MASK_TYPES: {
  id: MediaMaskType;
  label: string;
  icon: typeof faCircle;
}[] = [
  { id: "split", label: "Split", icon: faTableColumns },
  { id: "filmstrip", label: "Filmstrip", icon: faTableRows },
  { id: "circle", label: "Circle", icon: faCircle },
  { id: "rectangle", label: "Rectangle", icon: faSquare },
  { id: "stars", label: "Stars", icon: faStar },
  { id: "heart", label: "Heart", icon: faHeart },
  { id: "text", label: "Text", icon: faT },
  { id: "pen", label: "Pen", icon: faPen },
];

export function MediaMaskPanel({
  state,
  onChange,
  onAddLayer,
}: MediaMaskPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-4">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        {/* Preset */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex flex-1 items-center justify-between rounded-lg border border-white/10 bg-[#252830] px-3 py-2.5 text-left text-[13px] text-white/55 hover:border-white/20"
          >
            <span>Choose preset...</span>
            <FontAwesomeIcon
              icon={faChevronDown}
              className="text-[10px] opacity-50"
            />
          </button>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-[#252830] text-white/50 hover:bg-[#2a2d35]"
          >
            <FontAwesomeIcon icon={faBars} />
          </button>
        </div>

        {/* Mask Layers */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-white/50">Mask Layers</span>
          {state.layers.map((layer) => {
            const active = layer.id === state.activeLayerId;
            return (
              <button
                key={layer.id}
                type="button"
                onClick={() => onChange({ activeLayerId: layer.id })}
                className={twMerge(
                  "rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors",
                  active
                    ? "bg-[#2a3140] text-white ring-1 ring-white/12"
                    : "bg-[#1e2026] text-white/55 hover:bg-[#252830]",
                )}
              >
                {layer.name}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onAddLayer}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e2026] text-white/45 hover:bg-[#252830] hover:text-white/80"
            title="Add mask layer"
          >
            <FontAwesomeIcon icon={faPlus} className="text-[12px]" />
          </button>
        </div>

        {/* Mask Type */}
        <div>
          <div className="mb-2 text-[12px] text-white/50">Mask Type</div>
          <div className="flex flex-wrap gap-2">
            {MASK_TYPES.map((t) => {
              const active = state.maskType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onChange({ maskType: t.id })}
                  className={twMerge(
                    "flex w-[68px] flex-col items-center gap-1.5 rounded-xl border px-1 py-2 transition-colors",
                    active
                      ? "border-white/25 bg-white/6 text-white/80"
                      : "border-white/10 bg-[#1e2026] text-white/50 hover:border-white/20 hover:text-white/75",
                  )}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/20">
                    <FontAwesomeIcon icon={t.icon} className="text-[14px]" />
                  </div>
                  <span className="text-[10px]">{t.label}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-md text-white/35 hover:bg-white/5 hover:text-white/70"
              title="Reset"
            >
              <FontAwesomeIcon icon={faArrowRotateLeft} className="text-[12px]" />
            </button>
            <span className="text-[12px] text-white/50">Reverse Mask</span>
            <button
              type="button"
              role="switch"
              aria-checked={state.reverseMask}
              onClick={() => onChange({ reverseMask: !state.reverseMask })}
              className={twMerge(
                "relative h-5 w-9 rounded-full transition-colors",
                state.reverseMask ? "bg-white/35" : "bg-white/15",
              )}
            >
              <span
                className={twMerge(
                  "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                  state.reverseMask && "translate-x-4",
                )}
              />
            </button>
          </div>
        </div>

        {/* Position */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-14 shrink-0 text-[12px] text-white/50">
            Position
          </span>
          <NumBox
            prefix="X"
            value={state.posX}
            onChange={(v) => onChange({ posX: v })}
          />
          <NumBox
            prefix="Y"
            value={state.posY}
            onChange={(v) => onChange({ posY: v })}
          />
        </div>

        {/* Rotation + dial */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-14 shrink-0 text-[12px] text-white/50">
            Rotation
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex flex-1 items-center rounded-lg border border-white/10 bg-[#252830] px-3 py-2">
              <input
                type="number"
                value={state.rotation}
                onChange={(e) =>
                  onChange({ rotation: Number(e.target.value) || 0 })
                }
                className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none"
              />
              <span className="text-[12px] text-white/40">°</span>
            </div>
            <RotationDial
              degrees={state.rotation}
              onChange={(deg) => onChange({ rotation: deg })}
            />
          </div>
        </div>

        {/* Size */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-14 shrink-0 text-[12px] text-white/50">Size</span>
          <div className="flex flex-1 items-center rounded-lg border border-white/10 bg-[#252830] px-3 py-2">
            <input
              type="number"
              min={1}
              max={200}
              value={state.size}
              onChange={(e) =>
                onChange({ size: Math.max(1, Number(e.target.value) || 1) })
              }
              className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none"
            />
          </div>
        </div>

        {/* Feather */}
        <div>
          <div className="mb-1.5 text-[12px] text-white/50">Feather</div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              value={state.feather}
              onChange={(e) => onChange({ feather: Number(e.target.value) })}
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-sky-500"
            />
            <div className="w-14 rounded-md border border-white/10 bg-[#1e2026] px-1 py-1 text-center text-[11px] text-white/70">
              {state.feather}
            </div>
          </div>
        </div>

        {/* Frame ratio + zoom */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[12px] text-white/50">Frame ratio</span>
          <div className="relative">
            <select
              value={state.frameRatio}
              onChange={(e) => onChange({ frameRatio: e.target.value })}
              className="appearance-none rounded-lg border border-white/10 bg-[#252830] px-3 py-1.5 pr-7 text-[12px] text-white/80 outline-none"
            >
              {["16:9", "9:16", "1:1", "4:3"].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <FontAwesomeIcon
              icon={faChevronDown}
              className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[9px] text-white/40"
            />
          </div>
          <div className="ml-auto flex items-center gap-2 text-white/40">
            <FontAwesomeIcon
              icon={faMagnifyingGlassMinus}
              className="text-[11px]"
            />
            <input
              type="range"
              min={50}
              max={200}
              value={state.zoom}
              onChange={(e) => onChange({ zoom: Number(e.target.value) })}
              className="h-1 w-28 cursor-pointer appearance-none rounded-full bg-white/15 accent-sky-500"
            />
            <FontAwesomeIcon
              icon={faMagnifyingGlassPlus}
              className="text-[11px]"
            />
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/5 hover:text-white/70"
            >
              <FontAwesomeIcon icon={faArrowRotateLeft} className="text-[11px]" />
            </button>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/5 hover:text-white/70"
            >
              <FontAwesomeIcon
                icon={faArrowRotateRight}
                className="text-[11px]"
              />
            </button>
          </div>
        </div>

        {/* Preview canvas */}
        <MaskPreview
          maskType={state.maskType}
          rotation={state.rotation}
          size={state.size}
          feather={state.feather}
          reverse={state.reverseMask}
          posX={state.posX}
          posY={state.posY}
          zoom={state.zoom}
        />
      </div>
    </div>
  );
}

function NumBox({
  prefix,
  value,
  onChange,
}: {
  prefix: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex min-w-[100px] flex-1 items-center gap-2 rounded-lg border border-white/10 bg-[#252830] px-3 py-2">
      <span className="text-[11px] text-white/40">{prefix}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none"
      />
    </div>
  );
}

function RotationDial({
  degrees,
  onChange,
}: {
  degrees: number;
  onChange: (deg: number) => void;
}) {
  // Normalize for display ring
  const angle = ((degrees % 360) + 360) % 360;

  return (
    <button
      type="button"
      title="Drag conceptually — click to nudge"
      onClick={() => onChange(degrees - 15)}
      className="relative h-12 w-12 shrink-0 rounded-full border border-white/15 bg-gradient-to-b from-[#3a3d45] to-[#1e2026] shadow-inner"
      style={{
        backgroundImage: `conic-gradient(from ${angle}deg, #94a3b8 0deg, #94a3b8 8deg, transparent 8deg, transparent 360deg), linear-gradient(180deg,#3a3d45,#1e2026)`,
      }}
    >
      <span className="absolute inset-1.5 rounded-full border border-white/10 bg-[#252830]" />
      <span
        className="absolute top-1 left-1/2 h-2 w-0.5 -translate-x-1/2 rounded-full bg-white/80"
        style={{
          transform: `translateX(-50%) rotate(${angle}deg)`,
          transformOrigin: "50% 18px",
        }}
      />
    </button>
  );
}

function MaskPreview({
  maskType,
  rotation,
  size,
  feather,
  reverse,
  posX,
  posY,
  zoom,
}: {
  maskType: MediaMaskType;
  rotation: number;
  size: number;
  feather: number;
  reverse: boolean;
  posX: number;
  posY: number;
  zoom: number;
}) {
  const scale = zoom / 100;
  const stripH = Math.max(8, size * 0.35);

  return (
    <div className="relative mx-auto aspect-video w-full max-w-xl overflow-hidden rounded-lg border border-white/10 bg-[#0c0d10]">
      {/* Grid guides */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 right-0 left-0 border-t border-dashed border-white/10" />
        <div className="absolute top-0 bottom-0 left-1/2 border-l border-dashed border-white/10" />
      </div>

      {/* Mask visualization */}
      <div
        className="absolute top-1/2 left-1/2"
        style={{
          transform: `translate(calc(-50% + ${posX - 50}px), calc(-50% + ${posY - 50}px)) rotate(${rotation}deg) scale(${scale})`,
        }}
      >
        {maskType === "filmstrip" || maskType === "split" ? (
          <div
            className="relative rounded-sm"
            style={{
              width: 280,
              height: stripH,
              background: reverse
                ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)"
                : "linear-gradient(180deg, rgba(200,220,255,0.85), rgba(140,170,220,0.55), rgba(200,220,255,0.85))",
              boxShadow: `0 0 ${feather * 0.4}px rgba(180,200,255,0.5)`,
              opacity: reverse ? 0.35 : 0.9,
            }}
          >
            <div className="absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-white/40" />
          </div>
        ) : maskType === "circle" ? (
          <div
            className="rounded-full border-2 border-white/30 bg-white/5"
            style={{
              width: size * 3,
              height: size * 3,
              boxShadow: `0 0 ${feather * 0.5}px rgba(56,189,248,0.4)`,
            }}
          />
        ) : maskType === "heart" || maskType === "stars" ? (
          <FontAwesomeIcon
            icon={maskType === "heart" ? faHeart : faStar}
            className="text-white/80/80"
            style={{
              fontSize: size * 2,
              filter: `drop-shadow(0 0 ${feather * 0.2}px rgba(125,211,252,0.8))`,
            }}
          />
        ) : (
          <div
            className="border-2 border-white/25 bg-white/5"
            style={{
              width: size * 4,
              height: size * 3,
              borderRadius: maskType === "rectangle" ? 4 : 0,
              boxShadow: `0 0 ${feather * 0.4}px rgba(56,189,248,0.35)`,
            }}
          />
        )}

        {/* Center handles */}
        <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5">
          <div className="h-3 w-3 rounded-full border border-white/70 bg-white/20" />
          <div className="h-2 w-2 rounded-full border border-white/50 bg-white/25" />
        </div>
      </div>
    </div>
  );
}
