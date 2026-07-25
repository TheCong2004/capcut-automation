import { useEffect, useState } from "react";
import { useCapCutMate } from "../../api/CapCutMateContext";
import * as local from "../../api/capcutLocalClient";
import { formatDurationUs } from "../../api/capcutLocalClient";
import type { SyncTabId } from "../../types";

interface SyncTimelineProps {
  variant: SyncTabId;
  showSyncedBadge?: boolean;
}

type Seg = {
  id: string;
  track_type: string;
  text?: string;
  duration_us?: number;
  start_us?: number;
};

/**
 * Timeline thật từ draft local (segments) — không DEMO_* mock.
 */
export function SyncTimeline({
  variant,
  showSyncedBadge = false,
}: SyncTimelineProps) {
  const mate = useCapCutMate();
  const [segs, setSegs] = useState<Seg[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const project = mate.localProject.trim();

  useEffect(() => {
    if (!project) {
      setSegs([]);
      setErr(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await local.localSegments(project);
        if (cancelled) return;
        const raw = (res.segments || []) as Array<Record<string, unknown>>;
        setSegs(
          raw.map((s, i) => ({
            id: String(s.id ?? s.segment_id ?? i),
            track_type: String(
              s.track_type ?? s.material_type ?? s.type ?? "",
            ).toLowerCase(),
            text: s.text != null ? String(s.text) : undefined,
            duration_us:
              typeof s.duration === "number"
                ? s.duration
                : typeof s.duration_us === "number"
                  ? s.duration_us
                  : undefined,
            start_us:
              typeof s.start === "number"
                ? s.start
                : typeof s.start_us === "number"
                  ? s.start_us
                  : undefined,
          })),
        );
      } catch (e) {
        if (!cancelled) {
          setSegs([]);
          setErr(e instanceof Error ? e.message : "Lỗi segments");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project]);

  const showSubtitle =
    variant === "footage-subs" ||
    variant === "audio-subs" ||
    variant === "subs-audio" ||
    variant === "scene-list";
  const showFootage =
    variant === "footage-audio" ||
    variant === "footage-subs" ||
    variant === "scene-list";
  const showAudio =
    variant === "footage-audio" ||
    variant === "audio-subs" ||
    variant === "subs-audio" ||
    variant === "scene-list";

  const isText = (t: string) =>
    t.includes("text") || t.includes("caption") || t.includes("subtitle");
  const isAudio = (t: string) => t.includes("audio");
  const isVideo = (t: string) =>
    t.includes("video") || t.includes("image") || (!isAudio(t) && !isText(t));

  const texts = segs.filter((s) => isText(s.track_type));
  const videos = segs.filter((s) => isVideo(s.track_type) && !isText(s.track_type));
  const audios = segs.filter((s) => isAudio(s.track_type));

  return (
    <div className="shrink-0 border-t border-white/8 bg-[#15161a] px-5 py-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {showSyncedBadge ? (
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-1 text-[12px] font-medium text-emerald-400">
            Synced
          </span>
        ) : (
          <span className="rounded-full bg-white/10 px-4 py-1.5 text-[12px] font-medium text-amber-400/90">
            Live draft
          </span>
        )}
        <span className="text-[11px] text-white/35">
          {loading
            ? "Đang tải segments…"
            : project
              ? `${segs.length} segment từ BE`
              : "Chưa chọn Draft local"}
        </span>
        {err && (
          <span className="text-[11px] text-rose-300/80">{err}</span>
        )}
      </div>

      {!project && (
        <p className="text-[12px] text-white/40">
          Chọn project ở panel phải hoặc Draft local để xem timeline thật.
        </p>
      )}

      <div className="space-y-3">
        {showSubtitle && (
          <TrackRow label="Subtitle">
            {texts.length === 0 ? (
              <EmptyChip text="Không có text/caption" />
            ) : (
              texts.map((clip) => (
                <div
                  key={clip.id}
                  className="flex min-w-[120px] max-w-[200px] flex-1 items-center overflow-hidden rounded-md border border-orange-400/35 bg-gradient-to-b from-orange-700/75 to-orange-950/65 px-2.5 py-2.5"
                >
                  <span className="line-clamp-2 text-[11px] leading-snug text-orange-50/95">
                    {clip.text || clip.id.slice(0, 8)}
                  </span>
                </div>
              ))
            )}
          </TrackRow>
        )}

        {showFootage && (
          <TrackRow label="Footage">
            {videos.length === 0 ? (
              <EmptyChip text="Không có video/image" />
            ) : (
              videos.map((clip) => (
                <div
                  key={clip.id}
                  className="flex min-w-[100px] flex-col rounded-md border border-sky-400/30 bg-[#1e2430] px-2.5 py-2"
                >
                  <span className="truncate font-mono text-[10px] text-sky-200/80">
                    {clip.id.slice(0, 10)}
                  </span>
                  <span className="text-[10px] text-white/40">
                    {formatDurationUs(clip.duration_us) || clip.track_type}
                  </span>
                </div>
              ))
            )}
          </TrackRow>
        )}

        {showAudio && (
          <TrackRow label="Audio">
            {audios.length === 0 ? (
              <EmptyChip text="Không có audio" />
            ) : (
              audios.map((clip) => (
                <div
                  key={clip.id}
                  className="flex min-w-[100px] flex-col rounded-md border border-emerald-400/30 bg-[#152820] px-2.5 py-2"
                >
                  <span className="truncate font-mono text-[10px] text-emerald-200/80">
                    {clip.id.slice(0, 10)}
                  </span>
                  <span className="text-[10px] text-white/40">
                    {formatDurationUs(clip.duration_us) || "audio"}
                  </span>
                </div>
              ))
            )}
          </TrackRow>
        )}
      </div>
    </div>
  );
}

function TrackRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-stretch gap-3">
      <div className="w-16 shrink-0 pt-3 text-[12px] font-medium text-white/50">
        {label}
      </div>
      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
        {children}
      </div>
    </div>
  );
}

function EmptyChip({ text }: { text: string }) {
  return (
    <span className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/35">
      {text}
    </span>
  );
}
