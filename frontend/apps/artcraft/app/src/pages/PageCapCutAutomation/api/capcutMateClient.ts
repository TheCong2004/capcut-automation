/**
 * HTTP client cho BE CapCut local (hiện là process capcut-mate).
 *
 * ArtCraft chỉ nói chuyện **1 BE** — mọi request dùng base URL này.
 * Default: http://localhost:30000
 * Path API hiện tại: `/openapi/capcut-mate/v1/*`
 * (tương lai alias `/v1/*` — xem `capcutBeClient.ts` + docs/PLAN-gop-be-python.md)
 *
 * Prefer import từ `./capcutBeClient` cho code mới / Context.
 */

/**
 * Base URL mặc định của BE Python thống nhất (capcut-mate / `be` sau gộp).
 * Port 30000 — đổi 1 chỗ khi rename/host; localStorage override vẫn ưu tiên.
 */
export const CAPCUT_BE_BASE_URL = "http://127.0.0.1:30000";

const STORAGE_KEY = "capcut-mate-base-url";
const DEFAULT_BASE = CAPCUT_BE_BASE_URL;

export function getCapCutMateBaseUrl(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_BASE;
  } catch {
    return DEFAULT_BASE;
  }
}

export function setCapCutMateBaseUrl(url: string): void {
  const cleaned = url.replace(/\/$/, "");
  localStorage.setItem(STORAGE_KEY, cleaned);
}

function prefix(): string {
  return `${getCapCutMateBaseUrl()}/openapi/capcut-mate/v1`;
}

export class CapCutMateError extends Error {
  code?: number;
  constructor(message: string, code?: number) {
    super(message);
    this.name = "CapCutMateError";
    this.code = code;
  }
}

/**
 * Backoff giữa các lần thử lại khi KHÔNG kết nối được BE (vd process
 * capcut-mate chưa lên). Số phần tử = số lần retry → tổng cộng
 * `RETRY_DELAYS_MS.length + 1` lần thử (1 lần đầu + 3 retry).
 */
const RETRY_DELAYS_MS = [300, 900, 2000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Json = Record<string, unknown>;

async function request<T extends Json>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
    query?: Record<string, string>;
  } = {},
): Promise<T> {
  const method = options.method ?? "POST";
  let url = `${prefix()}${path}`;
  if (options.query) {
    const qs = new URLSearchParams(options.query).toString();
    if (qs) url += `?${qs}`;
  }

  let res: Response;
  // Retry chỉ khi fetch NÉM (BE chưa lên / mất kết nối). Response thật
  // (kể cả HTTP lỗi hay code !== 0) KHÔNG retry — đó là câu trả lời hợp lệ.
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch(url, {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body:
          method === "POST" && options.body !== undefined
            ? JSON.stringify(options.body)
            : undefined,
      });
      break;
    } catch (e) {
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw new CapCutMateError(
        e instanceof Error
          ? `Không kết nối được capcut-mate tại ${getCapCutMateBaseUrl()}: ${e.message}`
          : "Không kết nối được capcut-mate",
      );
    }
  }

  let data: Json;
  try {
    data = (await res.json()) as Json;
  } catch {
    throw new CapCutMateError(`Invalid JSON from ${path} (HTTP ${res.status})`);
  }

  // Middleware wraps success as { code: 0, message, ...fields }
  // Errors often still HTTP 200 with code !== 0
  const code = data.code as number | undefined;
  if (code !== undefined && code !== 0) {
    throw new CapCutMateError(
      String(data.message ?? data.detail ?? `Error code ${code}`),
      code,
    );
  }
  if (!res.ok) {
    throw new CapCutMateError(
      String(data.message ?? `HTTP ${res.status}`),
      res.status,
    );
  }

  return data as T;
}

async function probeBackendOnce(): Promise<boolean> {
  try {
    const base = getCapCutMateBaseUrl();
    // Prefer /health (unified BE smoke)
    const health = await fetch(`${base}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (health.ok) return true;
    const res = await fetch(`${base}/openapi.json`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Kiểm tra BE có online không.
 *
 * Mặc định retry với backoff (`RETRY_DELAYS_MS`) để bỏ qua blip lúc BE mới
 * lên — hợp cho manual check (HelpFab). Truyền `{ retries: 0 }` để probe 1
 * phát duy nhất khi caller tự lo lịch retry (vd poll trong Context, tránh
 * backoff chồng backoff).
 */
export async function pingBackend(
  opts: { retries?: number } = {},
): Promise<boolean> {
  const retries = opts.retries ?? RETRY_DELAYS_MS.length;
  for (let attempt = 0; ; attempt++) {
    if (await probeBackendOnce()) return true;
    if (attempt < retries && attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]);
      continue;
    }
    return false;
  }
}

export async function createDraft(width = 1080, height = 1920) {
  return request<{ draft_url: string; tip_url?: string }>("/create_draft", {
    body: { width, height },
  });
}

export async function saveDraft(draftUrl: string) {
  return request<{ draft_url: string }>("/save_draft", {
    body: { draft_url: draftUrl },
  });
}

export async function getDraft(draftId: string) {
  return request<{ draft_url?: string } & Json>("/get_draft", {
    method: "GET",
    query: { draft_id: draftId },
  });
}

export async function addVideos(
  draftUrl: string,
  videoInfos: Array<Record<string, unknown>>,
  extras: {
    alpha?: number;
    scale_x?: number;
    scale_y?: number;
    transform_x?: number;
    transform_y?: number;
  } = {},
) {
  return request<Json>("/add_videos", {
    body: {
      draft_url: draftUrl,
      video_infos: JSON.stringify(videoInfos),
      ...extras,
    },
  });
}

export async function addImages(
  draftUrl: string,
  imageInfos: Array<Record<string, unknown>>,
  extras: {
    alpha?: number;
    scale_x?: number;
    scale_y?: number;
    transform_x?: number;
    transform_y?: number;
  } = {},
) {
  return request<Json>("/add_images", {
    body: {
      draft_url: draftUrl,
      image_infos: JSON.stringify(imageInfos),
      ...extras,
    },
  });
}

export async function addAudios(
  draftUrl: string,
  audioInfos: Array<Record<string, unknown>>,
) {
  return request<Json>("/add_audios", {
    body: {
      draft_url: draftUrl,
      audio_infos: JSON.stringify(audioInfos),
    },
  });
}

export async function addCaptions(
  draftUrl: string,
  captions: Array<Record<string, unknown>>,
  style: Record<string, unknown> = {},
) {
  return request<Json>("/add_captions", {
    body: {
      draft_url: draftUrl,
      captions: JSON.stringify(captions),
      ...style,
    },
  });
}

export async function addEffects(
  draftUrl: string,
  effectInfos: Array<{ effect_title: string; start: number; end: number }>,
) {
  return request<Json>("/add_effects", {
    body: {
      draft_url: draftUrl,
      effect_infos: JSON.stringify(effectInfos),
    },
  });
}

export async function addFilters(
  draftUrl: string,
  filterInfos: Array<{
    filter_title: string;
    start: number;
    end: number;
    intensity?: number;
  }>,
) {
  return request<Json>("/add_filters", {
    body: {
      draft_url: draftUrl,
      filter_infos: JSON.stringify(filterInfos),
    },
  });
}

export async function addKeyframes(
  draftUrl: string,
  keyframes: Array<Record<string, unknown>>,
) {
  return request<Json>("/add_keyframes", {
    body: {
      draft_url: draftUrl,
      keyframes: JSON.stringify(keyframes),
    },
  });
}

export async function addMasks(
  draftUrl: string,
  body: {
    segment_ids: string[];
    name?: string;
    X?: number;
    Y?: number;
    width?: number;
    height?: number;
    feather?: number;
    rotation?: number;
    invert?: boolean;
    roundCorner?: number;
  },
) {
  return request<Json>("/add_masks", {
    body: { draft_url: draftUrl, ...body },
  });
}

export async function addSticker(
  draftUrl: string,
  body: {
    sticker_id: string;
    start: number;
    end: number;
    scale?: number;
    transform_x?: number;
    transform_y?: number;
  },
) {
  return request<Json>("/add_sticker", {
    body: { draft_url: draftUrl, ...body },
  });
}

export async function searchSticker(keyword: string) {
  return request<{ data: StickerSearchItem[] }>("/search_sticker", {
    body: { keyword },
  });
}

export interface StickerSearchItem {
  sticker_id: string;
  title: string;
  sticker?: {
    large_image?: { image_url?: string };
    preview_cover?: string;
    track_thumbnail?: string;
  };
}

export async function getEffects(mode = 0) {
  return request<{ effects: NamedResource[] }>("/get_effects", {
    body: { mode },
  });
}

export async function getFilters(mode = 0) {
  return request<{ filters: NamedResource[] }>("/get_filters", {
    body: { mode },
  });
}

export interface NamedResource {
  name: string;
  is_vip?: boolean;
  resource_id?: string;
  effect_id?: string;
  icon_url?: string;
  has_params?: boolean;
}

export async function getTextAnimations(mode?: string) {
  return request<{ effects: Array<{ name: string; type?: string }> }>(
    "/get_text_animations",
    { body: mode ? { mode } : {} },
  );
}

export async function getImageAnimations(mode?: string) {
  return request<{ effects: Array<{ name: string; type?: string }> }>(
    "/get_image_animations",
    { body: mode ? { mode } : {} },
  );
}

export async function genVideo(draftUrl: string) {
  return request<{ message?: string }>("/gen_video", {
    body: { draft_url: draftUrl },
  });
}

export async function genVideoStatus(draftUrl: string) {
  return request<{
    draft_url: string;
    status: string;
    progress: number;
    video_url?: string;
    error_message?: string;
  }>("/gen_video_status", {
    body: { draft_url: draftUrl },
  });
}

export async function getAudioDuration(audioUrl: string) {
  return request<{ duration?: number } & Json>("/get_audio_duration", {
    body: { mp3_url: audioUrl },
  });
}

export async function buildTimelines(body: {
  duration: number;
  num: number;
  start?: number;
  type?: string;
}) {
  return request<Json>("/timelines", { body });
}

/** 1 second in microseconds (capcut-mate time unit) */
export const US = 1_000_000;

export function requireDraftUrl(draftUrl: string | null | undefined): string {
  if (!draftUrl) {
    throw new CapCutMateError(
      "Chưa chọn draft — chọn 1 dự án ở danh sách bên phải hoặc bấm «Tạo draft»",
    );
  }
  return draftUrl;
}
