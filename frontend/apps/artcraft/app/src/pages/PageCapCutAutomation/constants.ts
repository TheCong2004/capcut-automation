import {
  faArrowsLeftRight,
  faClosedCaptioning,
  faWandMagicSparkles,
  faLayerGroup,
  faFilter,
  faPersonRunning,
  faVolumeHigh,
  faSliders,
  faPhotoFilm,
  faLink,
  faFilm,
  faSubtitles,
  faRotate,
  faDiamond,
  faDiagramProject,
  faRobot,
  faSparkles,
  faPuzzlePiece,
  faFaceSmile,
  faBoxOpen,
  faHardDrive,
} from "@fortawesome/pro-solid-svg-icons";
import type {
  AudioClip,
  FootageClip,
  SideNavItem,
  SyncTabItem,
} from "./types";

/** Side nav — nhãn tiếng Việt. */
export const SIDE_NAV: SideNavItem[] = [
  { id: "materials", label: "Nguyên liệu", icon: faBoxOpen },
  { id: "local-draft", label: "Draft local", icon: faHardDrive },
  { id: "workflow", label: "Quy trình (Workflow)", icon: faDiagramProject, badge: "Vip" },
  { id: "auto-render", label: "Xuất video", icon: faRobot, badge: "Vip" },
  { id: "sync", label: "Đồng bộ", icon: faArrowsLeftRight },
  { id: "caption", label: "Phụ đề", icon: faClosedCaptioning },
  { id: "effects", label: "Hiệu ứng", icon: faWandMagicSparkles },
  { id: "filters", label: "Bộ lọc", icon: faFilter },
  { id: "stickers", label: "Sticker", icon: faFaceSmile },
  { id: "transitions", label: "Chuyển cảnh", icon: faLayerGroup },
  { id: "animations", label: "Hoạt ảnh", icon: faPersonRunning },
  { id: "sounds", label: "Âm thanh", icon: faVolumeHigh },
  { id: "media", label: "Media / Mask", icon: faPhotoFilm },
  { id: "keyframe", label: "Keyframe", icon: faDiamond },
  { id: "adjustment", label: "Chỉnh màu", icon: faSliders, badge: "Soon" },
  { id: "ai-generate", label: "AI tạo", icon: faSparkles, badge: "Soon" },
  { id: "extension", label: "Tiện ích", icon: faPuzzlePiece, badge: "Soon" },
];

export const SYNC_TABS: SyncTabItem[] = [
  { id: "footage-audio", label: "Match Footage to Audio", icon: faLink },
  { id: "footage-subs", label: "Match Footage to Subtitles", icon: faFilm },
  { id: "audio-subs", label: "Match Audio to Subtitles", icon: faVolumeHigh },
  { id: "subs-audio", label: "Match Subtitles to Audio", icon: faSubtitles },
  { id: "scene-list", label: "Scene List Sync", icon: faRotate },
];

export const DEMO_SUBTITLES = [
  {
    id: "s1",
    text: "Most of our behavior starts ...",
    durationSec: 3.6,
  },
  {
    id: "s2",
    text: "it is shaped by tiny repeated c...",
    durationSec: 3.8,
  },
  {
    id: "s3",
    text: "A cue appears, the brain predicts a r...",
    durationSec: 4.5,
  },
] as const;

export const DEMO_SCENE_LIST = [
  {
    index: "001",
    text: "You do not have to change your whole life to become healthier.",
  },
  {
    index: "002",
    text: "Every morning, your body needs the right kind of start.",
  },
  {
    index: "003",
    text: "A glass of water and slow breaths can help you feel more awake.",
  },
] as const;

export const DEMO_FOOTAGE: FootageClip[] = [
  {
    id: "f1",
    label: "01_Image",
    durationSec: 4.1,
    kind: "image",
    swatches: ["#6B4F3A", "#8B6A4A", "#4A3A2A", "#A67C52", "#5C4033", "#7A5A40"],
  },
  {
    id: "f2",
    label: "02_Video",
    durationSec: 4.9,
    kind: "video",
    swatches: ["#3A5568", "#4A6578", "#2D3748", "#5A7588", "#3A4A58", "#1A2A38"],
  },
  {
    id: "f3",
    label: "03_Image",
    durationSec: 3.0,
    kind: "image",
    swatches: ["#8B6A3A", "#A67C42", "#6B5530", "#B89050"],
  },
];

export const DEMO_AUDIO: AudioClip[] = [
  { id: "a1", label: "audio_1.mp3", durationSec: 5.0 },
  { id: "a2", label: "audio_2.mp3", durationSec: 3.4 },
  { id: "a3", label: "audio_3.mp3", durationSec: 4.3 },
];
