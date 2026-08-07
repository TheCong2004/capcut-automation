import { saveDraftMate, genVideo, callCapCutMateApi, checkCdpConnection } from '../api/flowordClient';

export type ExecutionMode = 'api' | 'cli' | 'cdp' | 'manual';

export interface WorkflowInput {
  workflowName: string;
  prompt: string;
  topic?: string;
  sourceUrls: string[];
  sourceFiles: string[];
  targetPlatform: 'tiktok' | 'reels' | 'youtube_shorts';
  targetDurationSeconds: number;
  language: string;
  tone: 'professional' | 'storytelling' | 'educational' | 'review' | 'viral';
  aspectRatio: '9:16' | '16:9' | '1:1';
  scriptMode: 'original' | 'source_based' | 'commentary' | 'remix';
  outputMode: 'draft_only' | 'render_video';
  modelId?: string;
  musicPath?: string;
  characterReferencePath?: string;
}

export type StepStatus =
  | 'not_ready'
  | 'ready'
  | 'queued'
  | 'running'
  | 'waiting_input'
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export type WorkflowStatus =
  | 'queued'
  | 'preflight_check'
  | 'running'
  | 'waiting_input'
  | 'draft_ready'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'interrupted';

export interface WorkflowLog {
  timestamp: string;
  workflowId: string;
  stepId: string;
  level: 'info' | 'warn' | 'error' | 'browser' | 'api' | 'artifact';
  action: string;
  message: string;
  durationMs?: number;
  artifactId?: string;
  errorCode?: string;
}

export interface ArtifactRef {
  id: string;
  workflowId: string;
  stepId: string;
  type:
    | 'trend_data'
    | 'script'
    | 'image'
    | 'video'
    | 'audio'
    | 'subtitle'
    | 'timeline'
    | 'capcut_draft'
    | 'rendered_video'
    | 'screenshot'
    | 'trace';
  name: string;
  path: string;
  url?: string;
  sizeBytes: number;
  mimeType: string;
  sha256?: string;
  createdByStep: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface StepConfig {
  id: string;
  module: 'media_crawler' | 'omniroute' | 'youwee' | 'artcraft' | 'open_montage' | 'capcut';
  stepNumber: number;
  title: string;
  subtitle: string;
  description: string;
  enabled: boolean;
  executionMode: ExecutionMode;
  functions: string[];
  selectedFunction: string;
  timeoutMs: number;
  maxRetries: number;
  imageUrl: string;
}

export interface StepRun extends StepConfig {
  status: StepStatus;
  progress: number;
  currentAction?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  inputSummary?: unknown;
  outputSummary?: unknown;
  logs: WorkflowLog[];
  artifacts: ArtifactRef[];
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
}

export interface WorkflowRun {
  id: string;
  workflowName: string;
  input: WorkflowInput;
  status: WorkflowStatus;
  currentStepId: string | null;
  progress: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  steps: StepRun[];
  artifacts: ArtifactRef[];
  errorCode?: string;
  errorMessage?: string;
  resultType?: 'draft' | 'video';
  finalDraftId?: string;
  finalDraftPath?: string;
  finalDraftUrl?: string;
  finalVideoPath?: string;
  finalVideoUrl?: string;
}

export const INITIAL_STEP_CONFIGS: StepConfig[] = [
  {
    id: 'step-1',
    module: 'media_crawler',
    stepNumber: 1,
    title: 'MediaCrawler',
    subtitle: 'Thu thập Trend Market',
    description: 'Thu thập trend, comment, từ khóa TikTok/XHS',
    enabled: true,
    executionMode: 'api',
    functions: ['TikTok/XHS Trend Scraper', 'Comment Harvester', 'Virality Keyword Extractor'],
    selectedFunction: 'TikTok/XHS Trend Scraper',
    timeoutMs: 30000,
    maxRetries: 2,
    imageUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'step-2',
    module: 'omniroute',
    stepNumber: 2,
    title: 'OmniRoute LLM Gateway',
    subtitle: 'Kịch bản Phân cảnh (OmniRoute)',
    description: 'OmniRoute quản lý provider (grok2api/chatgpt2api), sinh kịch bản chi tiết',
    enabled: true,
    executionMode: 'api',
    functions: ['OmniRoute Multi-Provider Scriptwriter', 'grok2api / chatgpt2api Router', 'Shot-by-Shot Storyboarder'],
    selectedFunction: 'OmniRoute Multi-Provider Scriptwriter',
    timeoutMs: 45000,
    maxRetries: 2,
    imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'step-3',
    module: 'youwee',
    stepNumber: 3,
    title: 'Youwee',
    subtitle: 'Tải Tư liệu & Stock',
    description: 'Tìm kiếm và tải tư liệu thực tế, stock footage, nhạc nền theo cảnh',
    enabled: true,
    executionMode: 'api',
    functions: ['Real Scene Media Downloader', 'B-Roll Stock Harvester', 'Background Audio Fetcher'],
    selectedFunction: 'Real Scene Media Downloader',
    timeoutMs: 60000,
    maxRetries: 2,
    imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'step-4',
    module: 'artcraft',
    stepNumber: 4,
    title: 'ArtCraft',
    subtitle: 'Sinh Hình ảnh & 3D Stage',
    description: 'Khóa nhân vật, tạo bối cảnh 3D, sinh frame hình ảnh/video nhất quán',
    enabled: true,
    executionMode: 'cli',
    functions: ['Character Consistency Lock', '3D Stage Scene Generator', 'AI Image/Video Frame Synthesizer'],
    selectedFunction: 'Character Consistency Lock',
    timeoutMs: 90000,
    maxRetries: 1,
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'step-5',
    module: 'open_montage',
    stepNumber: 5,
    title: 'OpenMontage',
    subtitle: 'Giọng đọc AI TTS & Mix Sub',
    description: 'Sinh giọng đọc AI (TTS), phụ đề từng từ, mix audio & timeline',
    enabled: true,
    executionMode: 'cli',
    functions: ['AI Voice TTS Generator', 'Word-by-Word Subtitle Sync', 'Audio Track Mixing & Auto EQ'],
    selectedFunction: 'AI Voice TTS Generator',
    timeoutMs: 60000,
    maxRetries: 2,
    imageUrl: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'step-6',
    module: 'capcut',
    stepNumber: 6,
    title: 'CapCut CLI',
    subtitle: 'CapCut Timeline & Publisher',
    description: 'Import toàn bộ asset vào CapCut Timeline, chèn kỹ xảo, xuất bản',
    enabled: true,
    executionMode: 'cli',
    functions: ['CapCut Timeline Assembly', 'VFX & Transition Injector', 'Auto Social Publisher'],
    selectedFunction: 'CapCut Timeline Assembly',
    timeoutMs: 120000,
    maxRetries: 2,
    imageUrl: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=400&auto=format&fit=crop&q=80',
  },
];

export const DEFAULT_WORKFLOW_INPUT: WorkflowInput = {
  workflowName: 'CapCut Automation Launch Campaign',
  prompt: 'Tạo video 30 giây giới thiệu CapCut Automation, mở đầu bằng hook mạnh, gồm 5 cảnh, giọng kể chuyên nghiệp và kết thúc bằng CTA dùng thử.',
  topic: 'Video Editing Automation',
  sourceUrls: ['https://tiktok.com/@capcut_trends', 'https://xiaohongshu.com/explore/video_editing'],
  sourceFiles: [],
  targetPlatform: 'tiktok',
  targetDurationSeconds: 30,
  language: 'vi',
  tone: 'professional',
  aspectRatio: '9:16',
  scriptMode: 'original',
  outputMode: 'draft_only',
  modelId: 'auto',
};

// Persistence helper
const STORAGE_KEY = 'neodonut_workflow_run_active';

export function saveActiveWorkflowRun(run: WorkflowRun) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(run));
  } catch (e) {
    console.error('Failed to persist workflow run UI state', e);
  }
}

export function loadActiveWorkflowRun(): WorkflowRun | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Failed to load active workflow run UI state', e);
  }
  return null;
}
