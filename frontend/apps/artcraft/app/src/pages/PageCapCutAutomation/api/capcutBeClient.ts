/**
 * CapCut BE client — entry point duy nhất ArtCraft → 1 backend.
 *
 * Hiện tại: re-export / wrapper mỏng quanh `capcutMateClient` (cùng API).
 * Path vẫn `/openapi/capcut-mate/v1/*` (tương thích phase 0–1).
 *
 * Tương lai (PLAN P2+/P5): chuyển path sang `/v1/*` và/hoặc đổi
 * implementation tại đây mà không buộc đổi import site (Context + panels).
 *
 * @see docs/PLAN-gop-be-python.md
 * @see ./capcutMateClient.ts
 */

export {
  CAPCUT_BE_BASE_URL,
  CapCutMateError,
  US,
  getCapCutMateBaseUrl,
  setCapCutMateBaseUrl,
  pingBackend,
  createDraft,
  saveDraft,
  getDraft,
  addVideos,
  addImages,
  addAudios,
  addCaptions,
  addEffects,
  addFilters,
  addKeyframes,
  addMasks,
  addSticker,
  searchSticker,
  getEffects,
  getFilters,
  getTextAnimations,
  getImageAnimations,
  genVideo,
  genVideoStatus,
  getAudioDuration,
  buildTimelines,
  requireDraftUrl,
} from "./capcutMateClient";

export type {
  StickerSearchItem,
  NamedResource,
} from "./capcutMateClient";

/** Alias tên “BE” — cùng hàm với get/set CapCutMate base URL. */
export {
  getCapCutMateBaseUrl as getCapCutBeBaseUrl,
  setCapCutMateBaseUrl as setCapCutBeBaseUrl,
  CapCutMateError as CapCutBeError,
} from "./capcutMateClient";
