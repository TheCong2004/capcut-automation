import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faImage,
  faMusic,
  faPlus,
  faVideo,
} from "@fortawesome/pro-solid-svg-icons";
import { twMerge } from "tailwind-merge";
import toast from "react-hot-toast";
import { useCapCutMate } from "../../api/CapCutMateContext";
import * as api from "../../api/capcutBeClient";
import { PanelGuide } from "../../shared/PanelGuide";
import { PanelStatusAside } from "../../shared/PanelStatusAside";
import { ResizableSplit } from "../../shared/ResizableSplit";

type Kind = "video" | "image" | "audio";

const KIND_LABEL: Record<Kind, string> = {
  video: "video",
  image: "ảnh",
  audio: "audio",
};

/** Thêm media bằng URL vào draft — BE: add_videos / add_images / add_audios */
export function MaterialsPanel() {
  const mate = useCapCutMate();
  const [kind, setKind] = useState<Kind>("video");
  const [url, setUrl] = useState("");
  const [durationSec, setDurationSec] = useState(5);
  const [transition, setTransition] = useState("");
  const [busy, setBusy] = useState(false);

  const tabs: { id: Kind; label: string; icon: typeof faVideo }[] = [
    { id: "video", label: "Video", icon: faVideo },
    { id: "image", label: "Ảnh", icon: faImage },
    { id: "audio", label: "Audio", icon: faMusic },
  ];

  const handleAdd = async () => {
    const mediaUrl = url.trim();
    if (!mediaUrl) {
      toast.error("Dán URL media (http/https)");
      return;
    }
    if (!mediaUrl.startsWith("http://") && !mediaUrl.startsWith("https://")) {
      toast.error("URL phải bắt đầu bằng http:// hoặc https://");
      return;
    }
    // TikTok page URL không phải file media trực tiếp
    if (
      /tiktok\.com|douyin\.com/i.test(mediaUrl) &&
      !/\.(mp4|mov|webm)(\?|$)/i.test(mediaUrl)
    ) {
      toast.error(
        "Link TikTok trang web không dùng được — cần URL file .mp4 trực tiếp (CDN)",
      );
      return;
    }

    setBusy(true);
    try {
      const draftUrl = mate.ensureDraft();
      const start = mate.timelineEndUs;
      let end = start + Math.max(0.1, durationSec) * api.US;

      if (kind === "audio") {
        try {
          const d = await api.getAudioDuration(mediaUrl);
          if (typeof d.duration === "number" && d.duration > 0) {
            end = start + d.duration;
            setDurationSec(d.duration / api.US);
          }
        } catch {
          /* dùng duration tay */
        }
      }

      if (kind === "video") {
        const item: Record<string, unknown> = {
          video_url: mediaUrl,
          start,
          end,
          duration: end - start,
        };
        if (transition.trim()) {
          item.transition = transition.trim();
          item.transition_duration = 500_000;
        }
        await api.addVideos(draftUrl, [item]);
        toast.success("Đã thêm video vào draft");
      } else if (kind === "image") {
        const item: Record<string, unknown> = {
          image_url: mediaUrl,
          start,
          end,
        };
        if (transition.trim()) {
          item.transition = transition.trim();
          item.transition_duration = 500_000;
        }
        await api.addImages(draftUrl, [item]);
        toast.success("Đã thêm ảnh vào draft");
      } else {
        await api.addAudios(draftUrl, [
          { audio_url: mediaUrl, start, end, volume: 1 },
        ]);
        toast.success("Đã thêm audio vào draft");
      }

      mate.setTimelineEndUs(end);
      setUrl("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Thêm media thất bại");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#1a1b1f]">
      <PanelGuide
        what="Thêm video, ảnh, audio vào draft mate bằng URL file trực tiếp."
        how="① Tạo draft (thanh trên) · ② chọn loại · ③ dán URL http(s) · ④ thời lượng · ⑤ Thêm."
        need={
          mate.draftUrl
            ? "Đã có draft mate — dán link file .mp4/.jpg/.mp3 (không link trang TikTok)."
            : "Draft mate — bấm «Tạo draft» trước."
        }
        tone={mate.draftUrl ? "default" : "warn"}
      />
      <div className="border-b border-white/8 px-5 py-3">
        <h2 className="text-[15px] font-semibold text-white/90">Nguyên liệu</h2>
        <p className="mt-0.5 text-[12px] text-white/40">
          URL file →{" "}
          <code className="text-white/50">add_videos / add_images / add_audios</code>
        </p>
      </div>

      <ResizableSplit
        storageKey="capcut-split-materials"
        defaultWidth={280}
        minWidth={220}
        maxWidth={400}
        left={
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-xl space-y-5">
          <div className="flex gap-1 rounded-lg bg-[#121318] p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setKind(t.id)}
                className={twMerge(
                  "flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-[12px] font-medium transition-colors",
                  kind === t.id
                    ? "bg-[#2a3140] text-teal-300"
                    : "text-white/50 hover:text-white/75",
                )}
              >
                <FontAwesomeIcon icon={t.icon} />
                {t.label}
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] text-white/50">
              URL media (file trực tiếp)
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…/clip.mp4"
              className="w-full rounded-lg border border-white/10 bg-[#252830] px-3 py-2.5 font-mono text-[12px] text-white outline-none focus:border-teal-400/40"
            />
            <p className="mt-1 text-[10px] text-white/35">
              Cần link file (mp4/jpg/mp3…), không dùng link trang TikTok
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[12px] text-white/50">
                Thời lượng (giây)
              </label>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={durationSec}
                onChange={(e) => setDurationSec(Number(e.target.value) || 1)}
                className="w-full rounded-lg border border-white/10 bg-[#252830] px-3 py-2.5 text-[13px] text-white outline-none focus:border-teal-400/40"
              />
              {kind === "audio" && (
                <p className="mt-1 text-[10px] text-white/35">
                  Sẽ thử đo duration tự động trước
                </p>
              )}
            </div>
            {(kind === "video" || kind === "image") && (
              <div>
                <label className="mb-1.5 block text-[12px] text-white/50">
                  Chuyển cảnh (tuỳ chọn)
                </label>
                <input
                  value={transition}
                  onChange={(e) => setTransition(e.target.value)}
                  placeholder="淡入淡出"
                  className="w-full rounded-lg border border-white/10 bg-[#252830] px-3 py-2.5 text-[13px] text-white outline-none focus:border-teal-400/40"
                />
              </div>
            )}
          </div>

          <div className="rounded-lg border border-white/8 bg-[#16171b] px-3 py-2 text-[11px] text-white/45">
            Thêm vào timeline lúc{" "}
            <span className="text-white/70">
              {(mate.timelineEndUs / api.US).toFixed(2)}s
            </span>
            {" · "}
            {mate.draftUrl ? (
              <span className="text-emerald-400/80">đã có draft</span>
            ) : (
              <span className="text-amber-400/80">hãy tạo draft trước</span>
            )}
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => void handleAdd()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-500/90 py-2.5 text-[13px] font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
          >
            <FontAwesomeIcon icon={faPlus} />
            {busy
              ? "Đang thêm…"
              : `Thêm ${KIND_LABEL[kind]} vào draft`}
          </button>
        </div>
      </div>
        }
        right={
          <PanelStatusAside tip="Nguyên liệu ghi vào draft mate (URL). Project CapCut local dùng panel khác." />
        }
      />
    </div>
  );
}
