/**
 * ArtCraft → pure-Python **local draft** APIs trên capcut-mate (1 BE).
 *
 * - Prefix: `/openapi/capcut-mate/v1/local`
 * - Body luôn có `project` = folder draft hoặc path `draft_content.json`
 * - **Không** capcut-cli / subprocess Node
 *
 * ResponseMate middleware: HTTP 200 + `{ code, message, ... }` — client
 * phải check `code !== 0` (giống capcutMateClient), không chỉ `res.ok`.
 *
 * @see docs/LEADER-BOARD.md · docs/SINGLE-PROJECT-PYTHON.md
 */

import {
  getCapCutBeBaseUrl,
  CapCutBeError,
  CapCutMateError,
} from "./capcutBeClient";

/** Prefix local pure-Python (cùng host với CAPCUT_BE_BASE_URL). */
export function getLocalApiPrefix(): string {
  return `${getCapCutBeBaseUrl()}/openapi/capcut-mate/v1/local`;
}

function requireProject(project: string): string {
  const p = (project ?? "").trim();
  if (!p) {
    throw new CapCutMateError(
      "Thiếu project — truyền folder draft CapCut hoặc path draft_content.json",
      422,
    );
  }
  return p;
}

function formatDetail(detail: unknown): string {
  if (detail == null) return "";
  if (typeof detail === "string") {
    // Middleware often: `HTTP Error 404, detail: {"detail":"..."}`
    const m = detail.match(/detail:\s*(\{[\s\S]*\})\s*$/i);
    if (m) {
      try {
        const inner = JSON.parse(m[1]) as { detail?: unknown };
        if (inner.detail != null) return formatDetail(inner.detail);
      } catch {
        /* keep raw */
      }
    }
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          const loc = Array.isArray((item as { loc?: unknown }).loc)
            ? (item as { loc: unknown[] }).loc
                .filter((x) => x !== "body")
                .join(".")
            : "";
          const msg = String((item as { msg: unknown }).msg);
          return loc ? `${loc}: ${msg}` : msg;
        }
        return JSON.stringify(item);
      })
      .join("; ");
  }
  if (typeof detail === "object") {
    const o = detail as { detail?: unknown; message?: unknown };
    if (o.detail != null) return formatDetail(o.detail);
    if (o.message != null) return formatDetail(o.message);
    try {
      return JSON.stringify(detail);
    } catch {
      return String(detail);
    }
  }
  return String(detail);
}

/** Build human message from Mate middleware body. */
function errorMessageFromBody(data: Record<string, unknown>, fallback: string): string {
  return (
    formatDetail(data.message) ||
    formatDetail(data.detail) ||
    fallback
  );
}

/**
 * POST local API — parse middleware `{ code, message }` + HTTP errors.
 * Throws CapCutMateError / CapCutBeError on failure.
 */
async function postLocal<T = Record<string, unknown>>(
  path: string,
  body: unknown,
): Promise<T> {
  const url = `${getLocalApiPrefix()}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new CapCutMateError(
      e instanceof Error
        ? `Không kết nối BE local (pure Python) tại ${getCapCutBeBaseUrl()}: ${e.message}`
        : "Không kết nối BE local",
    );
  }

  let data: Record<string, unknown>;
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new CapCutMateError(
      `Invalid JSON from local${path} (HTTP ${res.status})`,
      res.status,
    );
  }

  // Middleware wraps success as { code: 0, message, ...fields }
  // Errors often still HTTP 200 with code !== 0 (404/422 → code)
  const code = data.code as number | undefined;
  if (code !== undefined && code !== 0) {
    throw new CapCutMateError(
      errorMessageFromBody(data, `Error code ${code}`),
      code,
    );
  }
  if (!res.ok) {
    throw new CapCutMateError(
      errorMessageFromBody(data, `HTTP ${res.status}`),
      res.status,
    );
  }

  return data as T;
}

async function getLocal<T = Record<string, unknown>>(path: string): Promise<T> {
  const url = `${getLocalApiPrefix()}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  } catch (e) {
    throw new CapCutMateError(
      e instanceof Error
        ? `Không kết nối BE local tại ${getCapCutBeBaseUrl()}: ${e.message}`
        : "Không kết nối BE local",
    );
  }

  let data: Record<string, unknown>;
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new CapCutMateError(
      `Invalid JSON from local${path} (HTTP ${res.status})`,
      res.status,
    );
  }

  const code = data.code as number | undefined;
  if (code !== undefined && code !== 0) {
    throw new CapCutMateError(
      errorMessageFromBody(data, `Error code ${code}`),
      code,
    );
  }
  if (!res.ok) {
    throw new CapCutMateError(
      errorMessageFromBody(data, `HTTP ${res.status}`),
      res.status,
    );
  }
  return data as T;
}

// ── types (partial — BE may add fields) ───────────────────────────────────

export interface LocalStatus {
  engine?: string;
  capcut_cli_required?: boolean;
  implemented?: string[];
  note?: string;
  code?: number;
  message?: string;
}

export interface LocalInfoResult {
  path?: string;
  code?: number;
  message?: string;
  [key: string]: unknown;
}

export interface LocalTracksResult {
  path?: string;
  tracks?: unknown[];
  code?: number;
  message?: string;
}

export interface LocalSegmentsResult {
  path?: string;
  segments?: unknown[];
  code?: number;
  message?: string;
}

// ── status ────────────────────────────────────────────────────────────────

/** GET /local/status — engine flags (pure Python, no CLI). */
export const localStatus = () => getLocal<LocalStatus>("/status");

// ── inspect (read-only) ───────────────────────────────────────────────────

export const localInfo = (project: string) => {
  const p = (project ?? "").trim();
  if (!p) return Promise.resolve<LocalInfoResult>({ ok: true, path: "" });
  return postLocal<LocalInfoResult>("/info", { project: p });
};

export const localTracks = (project: string) => {
  const p = (project ?? "").trim();
  if (!p) return Promise.resolve<LocalTracksResult>({ ok: true, path: "", tracks: [] });
  return postLocal<LocalTracksResult>("/tracks", { project: p });
};

export const localSegments = (project: string, track_type?: string) => {
  const p = (project ?? "").trim();
  if (!p) return Promise.resolve<LocalSegmentsResult>({ ok: true, path: "", segments: [] });
  return postLocal<LocalSegmentsResult>("/segments", {
    project: p,
    ...(track_type ? { track_type } : {}),
  });
};

// ── segment mutators ──────────────────────────────────────────────────────

export const localSpeed = (
  project: string,
  segment_id: string,
  speed: number,
) =>
  postLocal("/speed", {
    project: requireProject(project),
    segment_id,
    speed,
  });

export const localVolume = (
  project: string,
  segment_id: string,
  volume: number,
) =>
  postLocal("/volume", {
    project: requireProject(project),
    segment_id,
    volume,
  });

export const localOpacity = (
  project: string,
  segment_id: string,
  alpha: number,
) =>
  postLocal("/opacity", {
    project: requireProject(project),
    segment_id,
    alpha,
  });

export const localShift = (
  project: string,
  segment_id: string,
  offset_us: number,
) =>
  postLocal("/shift", {
    project: requireProject(project),
    segment_id,
    offset_us,
  });

export const localTrim = (
  project: string,
  segment_id: string,
  start_us: number,
  duration_us: number,
) =>
  postLocal("/trim", {
    project: requireProject(project),
    segment_id,
    start_us,
    duration_us,
  });

// ── A SRT ─────────────────────────────────────────────────────────────────

export const localImportSrt = (
  project: string,
  opts: { srt?: string; srt_path?: string; font_size?: number },
) =>
  postLocal("/import-srt", {
    project: requireProject(project),
    ...opts,
  });

export const localExportSrt = (project: string) =>
  postLocal<{ srt?: string; ok?: boolean; path?: string }>("/export-srt", {
    project: requireProject(project),
  });

// ── B motion ──────────────────────────────────────────────────────────────

export const localKeyframe = (
  project: string,
  segment_id: string,
  property: string,
  offset_us: number,
  value: number,
) =>
  postLocal("/keyframe", {
    project: requireProject(project),
    segment_id,
    property,
    offset_us,
    value,
  });

export const localTransition = (
  project: string,
  segment_id: string,
  name: string,
  duration_us = 500_000,
) =>
  postLocal("/transition", {
    project: requireProject(project),
    segment_id,
    name,
    duration_us,
  });

// ── C visual ──────────────────────────────────────────────────────────────

export const localMask = (
  project: string,
  segment_id: string,
  opts: {
    name?: string;
    width?: number;
    height?: number;
    feather?: number;
    off?: boolean;
  } = {},
) =>
  postLocal("/mask", {
    project: requireProject(project),
    segment_id,
    ...opts,
  });

export const localTransform = (
  project: string,
  segment_id: string,
  opts: {
    scale_x?: number;
    scale_y?: number;
    transform_x?: number;
    transform_y?: number;
    rotation?: number;
  },
) =>
  postLocal("/transform", {
    project: requireProject(project),
    segment_id,
    ...opts,
  });

// ── D content ─────────────────────────────────────────────────────────────

export const localMaterials = (project: string) =>
  postLocal("/materials", { project: requireProject(project) });

export const localTexts = (project: string) =>
  postLocal("/texts", { project: requireProject(project) });

export const localSetText = (
  project: string,
  text: string,
  ids: {
    segment_id?: string;
    material_id?: string;
    recalc_style?: boolean;
    font_size?: number;
  },
) =>
  postLocal("/set-text", {
    project: requireProject(project),
    text,
    ...ids,
  });

export const localAddText = (
  project: string,
  text: string,
  start_us: number,
  duration_us: number,
  font_size = 15,
  color?: string,
) =>
  postLocal("/add-text", {
    project: requireProject(project),
    text,
    start_us,
    duration_us,
    font_size,
    ...(color ? { color } : {}),
  });

/** Parse content JSON style ranges for one text material. */
export const localTextStyles = (
  project: string,
  ids: { segment_id?: string; material_id?: string },
) =>
  postLocal("/text-styles", {
    project: requireProject(project),
    ...ids,
  });

// ── WAVE2 E tooling / batch (pure Python — no capcut-cli) ──────────────────

export const localLint = (
  project: string,
  opts: {
    max_chars_per_line?: number;
    max_cue_duration_us?: number;
    min_gap_between_captions_us?: number;
    check_local_paths?: boolean;
  } = {},
) => postLocal("/lint", { project: requireProject(project), ...opts });

export const localLintFix = (
  project: string,
  opts: {
    max_chars_per_line?: number;
    max_cue_duration_us?: number;
    min_gap_between_captions_us?: number;
    check_local_paths?: boolean;
  } = {},
) => postLocal("/lint-fix", { project: requireProject(project), ...opts });

/** Env doctor — project optional (body empty). */
export const localDoctor = () => postLocal("/doctor", {});

export const localRestore = (project: string, step = 1) =>
  postLocal("/restore", { project: requireProject(project), step });

export const localRegister = (project: string, apply = true) =>
  postLocal("/register", { project: requireProject(project), apply });

export const localSyncTimelines = (project: string) =>
  postLocal("/sync-timelines", { project: requireProject(project) });

export const localDiagnose = (project: string) =>
  postLocal("/diagnose", { project: requireProject(project) });

export const localFixture = (project: string, out_dir: string) =>
  postLocal("/fixture", {
    project: requireProject(project),
    out_dir,
  });

export const localBatch = (
  project: string,
  ops: Array<Record<string, unknown>>,
  opts: { dry_run?: boolean; stop_on_error?: boolean } = {},
) =>
  postLocal("/batch", {
    project: requireProject(project),
    ops,
    ...opts,
  });

export const localCompile = (
  spec: Record<string, unknown>,
  out_dir: string,
  overwrite = false,
) => postLocal("/compile", { spec, out_dir, overwrite });

export const localDescribe = () => getLocal("/describe");

export const localPortMatrix = () => getLocal("/port-matrix");

export const localConfig = () => postLocal("/config", {});

export const localRender = (
  project: string,
  opts: { out_path?: string; skip?: boolean } = {},
) =>
  postLocal("/render", {
    project: requireProject(project),
    ...opts,
  });

/** Detect JianYing encryption only — does not decrypt. */
export const localDecrypt = (project: string) =>
  postLocal("/decrypt", { project: requireProject(project) });

// ── WAVE2 A–D client hooks (routes mount when those Grok land) ────────────

export const localCrop = (
  project: string,
  segment_id: string,
  opts: Record<string, unknown>,
) =>
  postLocal("/crop", {
    project: requireProject(project),
    segment_id,
    ...opts,
  });

export const localDuplicate = (project: string, segment_id: string) =>
  postLocal("/duplicate", {
    project: requireProject(project),
    segment_id,
  });

export const localReplaceMedia = (
  project: string,
  segment_id: string,
  path: string,
) =>
  postLocal("/replace-media", {
    project: requireProject(project),
    segment_id,
    path,
  });

export const localRelink = (
  project: string,
  opts: Record<string, unknown> = {},
) => postLocal("/relink", { project: requireProject(project), ...opts });

export const localPrune = (project: string) =>
  postLocal("/prune", { project: requireProject(project) });

export const localAddCover = (
  project: string,
  opts: Record<string, unknown> = {},
) => postLocal("/add-cover", { project: requireProject(project), ...opts });

export const localAudioFade = (
  project: string,
  segment_id: string,
  opts: { fade_in_us?: number; fade_out_us?: number },
) =>
  postLocal("/audio-fade", {
    project: requireProject(project),
    segment_id,
    ...opts,
  });

export const localAddVideo = (
  project: string,
  path: string,
  opts: Record<string, unknown> = {},
) =>
  postLocal("/add-video", {
    project: requireProject(project),
    // BE schema: file (path on disk)
    file: path,
    path,
    ...opts,
  });

export const localAddAudio = (
  project: string,
  path: string,
  opts: Record<string, unknown> = {},
) =>
  postLocal("/add-audio", {
    project: requireProject(project),
    // BE AddAudioBody.file
    file: path,
    path,
    ...opts,
  });

export const localMaterial = (project: string, material_id: string) =>
  postLocal("/material", {
    project: requireProject(project),
    material_id,
  });

export const localSegment = (project: string, segment_id: string) =>
  postLocal("/segment", {
    project: requireProject(project),
    segment_id,
  });

export const localBgBlur = (
  project: string,
  segment_id: string,
  opts: Record<string, unknown> = {},
) =>
  postLocal("/bg-blur", {
    project: requireProject(project),
    segment_id,
    ...opts,
  });

export const localChroma = (
  project: string,
  segment_id: string,
  opts: Record<string, unknown> = {},
) =>
  postLocal("/chroma", {
    project: requireProject(project),
    segment_id,
    ...opts,
  });

export const localMixMode = (
  project: string,
  segment_id: string,
  mode: string,
) =>
  postLocal("/mix-mode", {
    project: requireProject(project),
    segment_id,
    mode,
  });

export const localTextAnim = (
  project: string,
  segment_id: string,
  opts: Record<string, unknown>,
) =>
  postLocal("/text-anim", {
    project: requireProject(project),
    segment_id,
    ...opts,
  });

export const localImageAnim = (
  project: string,
  segment_id: string,
  opts: Record<string, unknown>,
) =>
  postLocal("/image-anim", {
    project: requireProject(project),
    segment_id,
    ...opts,
  });

export const localTextStyle = (
  project: string,
  segment_id: string,
  style: Record<string, unknown>,
) =>
  postLocal("/text-style", {
    project: requireProject(project),
    segment_id,
    ...style,
  });

export const localBubbleText = (
  project: string,
  opts: Record<string, unknown>,
) => postLocal("/bubble-text", { project: requireProject(project), ...opts });

export const localAddSfx = (
  project: string,
  opts: Record<string, unknown>,
) => postLocal("/add-sfx", { project: requireProject(project), ...opts });

export const localAddFilterLocal = (
  project: string,
  opts: Record<string, unknown>,
) => postLocal("/add-filter", { project: requireProject(project), ...opts });

export const localAddEffectLocal = (
  project: string,
  opts: Record<string, unknown>,
) => postLocal("/add-effect", { project: requireProject(project), ...opts });

export const localAddEffectsBatchLocal = (
  project: string,
  effects: { name: string; start_us?: number; duration_us?: number; track_name?: string; face?: boolean }[],
) => postLocal("/add-effects-batch", { project: requireProject(project), effects });

export const localGetProjectEffects = (project: string) =>
  postLocal<{ ok: boolean; effects: { id: string; name: string; resource_id: string }[] }>("/project-effects", { project: requireProject(project) });

export const localRemoveEffect = (project: string, opts: { name?: string; material_id?: string }) =>
  postLocal<{ ok: boolean; removed: number }>("/remove-effect", { project: requireProject(project), ...opts });

export const localAddStickerLocal = (
  project: string,
  opts: Record<string, unknown>,
) => postLocal("/add-sticker", { project: requireProject(project), ...opts });

export const localEnums = (opts: Record<string, unknown> = {}) =>
  postLocal("/enums", opts);

export const localCut = (
  project: string,
  opts: Record<string, unknown>,
) => postLocal("/cut", { project: requireProject(project), ...opts });

export const localConcat = (opts: Record<string, unknown>) =>
  postLocal("/concat", opts);

export const localDiff = (project_a: string, project_b: string) =>
  postLocal("/diff", { project_a, project_b });

export const localDetectScenes = (
  project: string,
  opts: Record<string, unknown> = {},
) =>
  postLocal("/detect-scenes", {
    project: requireProject(project),
    ...opts,
  });

export const localTimeline = (project: string) =>
  postLocal("/timeline", { project: requireProject(project) });

export interface LocalProjectItem {
  folder?: string;
  path?: string;
  project?: string;
  mtime?: string;
  root?: string;
  name?: string;
  name_raw?: string;
  /** Absolute cover path on BE machine (if exists) */
  cover_path?: string;
  has_cover?: boolean;
  /** Timeline duration microseconds (0 = empty / chưa có clip) */
  duration_us?: number;
  /** Không có media/segment */
  empty?: boolean;
  media?: {
    videos?: number;
    audios?: number;
    images?: number;
    texts?: number;
    segments?: number;
  };
}

/** URL ảnh cover phục vụ bởi BE GET /local/cover?project= */
export function localProjectCoverUrl(projectFolder: string): string {
  const base = getCapCutBeBaseUrl();
  const q = encodeURIComponent(projectFolder);
  return `${base}/openapi/capcut-mate/v1/local/cover?project=${q}`;
}

export function formatDurationUs(us?: number): string {
  if (us == null || !Number.isFinite(us) || us < 0) return "";
  if (us === 0) return "Trống";
  const totalMs = Math.floor(us / 1000);
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(ms, 3)}`;
  return `${pad(m)}:${pad(s)}:${pad(ms, 3)}`;
}

export interface LocalProjectsResult {
  ok?: boolean;
  count?: number;
  projects?: LocalProjectItem[];
  code?: number;
  message?: string;
}

/** Quét folder CapCut/JianYing (hoặc drafts_dir tùy chỉnh). names=true đọc tên từ draft. */
export const localProjects = (
  opts: {
    drafts_dir?: string;
    query?: string;
    names?: boolean;
  } = {},
) => postLocal<LocalProjectsResult>("/projects", opts);

/** Xóa hẳn folder draft trên đĩa (cần confirm: true). */
export const localDeleteProject = (project: string, confirm = true) =>
  postLocal<{ ok?: boolean; deleted?: string; message?: string }>(
    "/delete-project",
    {
      project: requireProject(project),
      confirm,
    },
  );

export const localShiftAll = (project: string, offset_us: number) =>
  postLocal("/shift-all", {
    project: requireProject(project),
    offset_us,
  });

export const localVersion = (project: string) =>
  postLocal("/version", { project: requireProject(project) });

export const localInit = (opts: Record<string, unknown>) =>
  postLocal("/init", opts);

export const localQuickstart = (opts: Record<string, unknown>) =>
  postLocal("/quickstart", opts);

export const localImportAss = (
  project: string,
  opts: { ass?: string; ass_path?: string },
) =>
  postLocal("/import-ass", {
    project: requireProject(project),
    ...opts,
  });

export const localTextRanges = (
  project: string,
  opts: Record<string, unknown>,
) =>
  postLocal("/text-ranges", {
    project: requireProject(project),
    ...opts,
  });

export const localCaption = (
  project: string,
  opts: Record<string, unknown> = {},
) =>
  postLocal("/caption", {
    project: requireProject(project),
    ...opts,
  });

export const localTranslate = (
  project: string,
  opts: Record<string, unknown> = {},
) =>
  postLocal("/translate", {
    project: requireProject(project),
    ...opts,
  });

/** Alias error class used by local client. */
export { CapCutMateError, CapCutBeError };
