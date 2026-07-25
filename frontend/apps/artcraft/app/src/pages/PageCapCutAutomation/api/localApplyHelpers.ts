/**
 * Helpers dùng chung khi panel Apply → API /v1/local/* (draft trên đĩa).
 */
import * as local from "./capcutLocalClient";
import { CapCutMateError } from "./capcutBeClient";

export interface LocalSegmentRow {
  id?: string;
  segment_id?: string;
  track_type?: string;
  material_type?: string;
  type?: string;
  [key: string]: unknown;
}

export function requireLocalProject(path: string | null | undefined): string {
  const p = (path ?? "").trim();
  if (!p) {
    throw new CapCutMateError(
      "Chưa có path draft local — mở menu «Draft local», nhập folder CapCut rồi «Lưu path»",
      422,
    );
  }
  return p;
}

function segId(s: LocalSegmentRow): string | null {
  const id = s.id ?? s.segment_id;
  return id != null && String(id).trim() ? String(id) : null;
}

function trackType(s: LocalSegmentRow): string {
  return String(s.track_type ?? s.material_type ?? s.type ?? "").toLowerCase();
}

export async function fetchLocalSegments(
  project: string,
  track_type?: string,
): Promise<LocalSegmentRow[]> {
  const res = await local.localSegments(project, track_type);
  return (res.segments || []) as LocalSegmentRow[];
}

export async function listSegmentIds(
  project: string,
  kinds: "video" | "audio" | "text" | "all" = "all",
): Promise<string[]> {
  const segs = await fetchLocalSegments(project);
  const ids: string[] = [];
  for (const s of segs) {
    const id = segId(s);
    if (!id) continue;
    if (kinds === "all") {
      ids.push(id);
      continue;
    }
    const t = trackType(s);
    if (kinds === "video" && (t.includes("video") || t.includes("image") || !t)) {
      // video track often "video"; empty → include cautiously only if few
      if (t.includes("video") || t.includes("image")) ids.push(id);
      else if (!t) ids.push(id);
    } else if (kinds === "audio" && t.includes("audio")) {
      ids.push(id);
    } else if (
      kinds === "text" &&
      (t.includes("text") || t.includes("caption") || t.includes("subtitle"))
    ) {
      ids.push(id);
    }
  }
  // fallback: if video filter empty, return all non-audio/non-text
  if (kinds === "video" && ids.length === 0) {
    for (const s of segs) {
      const id = segId(s);
      if (!id) continue;
      const t = trackType(s);
      if (t.includes("audio") || t.includes("text") || t.includes("caption"))
        continue;
      ids.push(id);
    }
  }
  return ids;
}

/** dB → linear gain (approx, 0 dB = 1.0). */
export function dbToLinear(db: number): number {
  return Math.max(0, Math.min(4, Math.pow(10, db / 20)));
}

export function secToUs(sec: number): number {
  return Math.round(Math.max(0, sec) * 1_000_000);
}
