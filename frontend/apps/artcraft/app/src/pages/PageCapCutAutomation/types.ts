import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

export type SideNavId =
  | "materials"
  | "local-draft"
  | "sync"
  | "caption"
  | "effects"
  | "transitions"
  | "filters"
  | "animations"
  | "sounds"
  | "stickers"
  | "adjustment"
  | "media"
  | "keyframe"
  | "workflow"
  | "auto-render"
  | "ai-generate"
  | "extension";

export type SyncTabId =
  | "footage-audio"
  | "footage-subs"
  | "audio-subs"
  | "subs-audio"
  | "scene-list";

export type SyncMode = "one-to-one" | "equal-divide" | "fixed-duration";

export type SyncCaptionSource = "in-project" | "external-srt";

export type CaptionSourceTab = "external-file" | "selected-project";

export interface SideNavItem {
  id: SideNavId;
  label: string;
  icon: IconDefinition;
  badge?: "Vip" | "Beta" | "Soon";
}

export interface SyncTabItem {
  id: SyncTabId;
  label: string;
  icon: IconDefinition;
}

export interface FootageClip {
  id: string;
  label: string;
  durationSec: number;
  kind: "image" | "video";
  swatches: string[];
}

export interface AudioClip {
  id: string;
  label: string;
  durationSec: number;
}

export interface CaptionRow {
  id: string;
  index: number;
  text: string;
}

export type EffectsCategoryId = "all" | "video" | "body" | "favorites";

export type EffectsApplyMode = "all" | "alternate" | "randomize";

export interface EffectItem {
  id: string;
  name: string;
  category: "video" | "body";
  /** CSS gradient / solid used as thumbnail placeholder */
  thumb: string;
  favorite?: boolean;
}

export type TransitionsCategoryId = "all" | "favorites";

export type TransitionsAnimMode = "alternate" | "randomize";

export interface TransitionItem {
  id: string;
  name: string;
  thumb: string;
  favorite?: boolean;
}

export type FiltersCategoryId = "all" | "favorites";

export type FiltersApplyMode = "all-clips" | "alternate" | "randomize";

export interface FilterItem {
  id: string;
  name: string;
  thumb: string;
  favorite?: boolean;
}

export type AnimationsCategoryId = "in" | "out" | "combo";

export type AnimationsDurationUnit = "seconds" | "percentage";

export type AnimationsTargetScope = "all-clips" | "first-clip";

export interface AnimationItem {
  id: string;
  name: string;
  category: AnimationsCategoryId;
  thumb: string;
  favorite?: boolean;
}

export type SoundsCategoryId = "music" | "sound-effects" | "my-audio";

export type SoundsPlacementRule =
  | "start-of-each-clip"
  | "end-of-each-clip"
  | "entire-timeline";

export interface SoundItem {
  id: string;
  name: string;
  category: SoundsCategoryId;
  /** Duration display e.g. "01:37" */
  durationLabel: string;
  durationSec: number;
  thumb: string;
  favorite?: boolean;
}

export interface LutItem {
  id: string;
  name: string;
  thumb: string;
}

export interface AdjustmentSliders {
  sharpen: number;
  clarity: number;
  particles: number;
  fade: number;
  vignette: number;
}

export type MediaKindTab = "video" | "audio";

export type MediaVideoSubTab = "basic" | "mask";

export type MediaMaskType =
  | "split"
  | "filmstrip"
  | "circle"
  | "rectangle"
  | "stars"
  | "heart"
  | "text"
  | "pen";

export interface MediaMaskLayer {
  id: string;
  name: string;
  type: MediaMaskType;
}

export type KeyframeUnit = "ms" | "percent";

export type KeyframeApplyMode = "all" | "custom";

export interface KeyframeTemplate {
  id: string;
  name: string;
  duration: number;
  scaleW: number;
  scaleH: number;
  uniformScale: boolean;
  posX: number;
  posY: number;
  rotate: number;
}
