import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faPlus } from "@fortawesome/pro-solid-svg-icons";
import { twMerge } from "tailwind-merge";
import toast from "react-hot-toast";
import { useCapCutMate } from "../../api/CapCutMateContext";
import * as api from "../../api/capcutBeClient";
import * as local from "../../api/capcutLocalClient";
import { PanelGuide } from "../../shared/PanelGuide";
import { ResizableSplit } from "../../shared/ResizableSplit";

/** Tìm + gắn sticker — BE: search_sticker · add_sticker */
export function StickersPanel() {
  const mate = useCapCutMate();
  const [keyword, setKeyword] = useState("开心");
  const [results, setResults] = useState<api.StickerSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [durationSec, setDurationSec] = useState(3);
  const [scale, setScale] = useState(1);
  const [addingId, setAddingId] = useState<string | null>(null);

  const search = async () => {
    const q = keyword.trim();
    if (!q) {
      toast.error("Nhập từ khóa tìm sticker");
      return;
    }
    setSearching(true);
    try {
      const res = await api.searchSticker(q);
      setResults(res.data ?? []);
      if (!(res.data ?? []).length) toast("Không tìm thấy sticker");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tìm sticker thất bại");
    } finally {
      setSearching(false);
    }
  };

  const add = async (item: api.StickerSearchItem) => {
    setAddingId(item.sticker_id);
    try {
      const start = mate.timelineEndUs;
      const end = start + Math.max(0.1, durationSec) * api.US;
      const infos = [{ sticker_id: item.sticker_id, start, end, scale }];
      if (mate.localProject && !mate.draftUrl) {
        await local.localAddStickerLocal(mate.localProject, {
          resource_id: item.sticker_id,
          start_us: start,
          duration_us: Math.max(100_000, Math.round(durationSec * api.US)),
          scale,
        });
        toast.success(`Đã thêm sticker vào draft local ${mate.localProject.split(/[/\\]/).filter(Boolean).pop()}`);
      } else {
        const draftUrl = mate.ensureDraft();
        await api.addSticker(draftUrl, {
          sticker_id: item.sticker_id,
          start,
          end,
          scale,
        });
        toast.success(`Đã thêm sticker: ${item.title || item.sticker_id}`);
      }
      mate.setTimelineEndUs(Math.max(mate.timelineEndUs, end));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Thêm sticker thất bại");
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#1a1b1f]">
      <PanelGuide
        what="Tìm sticker CapCut theo từ khóa và gắn vào timeline draft mate."
        how="① Tạo draft · ② gõ từ khóa → Tìm · ③ chỉnh duration/scale · ④ Thêm (+) sticker."
        need={
          mate.draftUrl
            ? "Đã có draft mate."
            : "Draft mate — «Tạo draft» trên thanh trên."
        }
        tone={mate.draftUrl ? "default" : "warn"}
      />
      <ResizableSplit
        storageKey="capcut-split-stickers"
        defaultWidth={300}
        minWidth={240}
        maxWidth={420}
        left={
          <div className="flex h-full min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b border-white/6 px-4 py-3">
              <div className="relative min-w-0 flex-1">
                <FontAwesomeIcon
                  icon={faMagnifyingGlass}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[11px] text-white/35"
                />
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void search()}
                  className="w-full rounded-lg border border-white/10 bg-[#252830] py-2 pr-3 pl-9 text-[13px] text-white outline-none focus:border-pink-400/40"
                  placeholder="Từ khóa (vd: 人, 花, vui)"
                />
              </div>
              <button
                type="button"
                disabled={searching}
                onClick={() => void search()}
                className="rounded-lg bg-pink-500/90 px-4 py-2 text-[12px] font-semibold text-white hover:bg-pink-500 disabled:opacity-50"
              >
                {searching ? "…" : "Tìm"}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {results.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-[13px] text-white/35">
                  Bấm «Tìm» để tải sticker từ BE
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {results.map((item) => {
                    const thumb =
                      item.sticker?.track_thumbnail ||
                      item.sticker?.preview_cover ||
                      item.sticker?.large_image?.image_url;
                    return (
                      <div
                        key={item.sticker_id}
                        className="flex flex-col overflow-hidden rounded-lg border border-white/8 bg-[#16171b]"
                      >
                        <div className="flex aspect-square items-center justify-center bg-[#0e0f12]">
                          {thumb ? (
                            <img
                              src={thumb}
                              alt={item.title}
                              className="max-h-full max-w-full object-contain"
                            />
                          ) : (
                            <span className="text-[11px] text-white/30">
                              không ảnh
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 p-2">
                          <span className="min-w-0 flex-1 truncate text-[11px] text-white/70">
                            {item.title || item.sticker_id}
                          </span>
                          <button
                            type="button"
                            disabled={addingId === item.sticker_id}
                            onClick={() => void add(item)}
                            className={twMerge(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-pink-500/80 text-white hover:bg-pink-500",
                              addingId === item.sticker_id && "opacity-50",
                            )}
                            title="Thêm vào draft"
                          >
                            <FontAwesomeIcon
                              icon={faPlus}
                              className="text-[10px]"
                            />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        }
        right={
          <aside className="flex h-full min-h-0 w-full flex-col border-l border-white/8 bg-[#16171b] px-4 py-4">
            <h2 className="mb-3 text-[14px] font-semibold text-white/90">
              Tuỳ chọn gắn
            </h2>
            <label className="mb-3 block text-[12px] text-white/50">
              Thời lượng (giây)
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={durationSec}
                onChange={(e) => setDurationSec(Number(e.target.value) || 1)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#252830] px-3 py-2 text-[13px] text-white outline-none"
              />
            </label>
            <label className="mb-3 block text-[12px] text-white/50">
              Tỷ lệ (scale)
              <input
                type="number"
                min={0.1}
                max={5}
                step={0.1}
                value={scale}
                onChange={(e) => setScale(Number(e.target.value) || 1)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#252830] px-3 py-2 text-[13px] text-white outline-none"
              />
            </label>
            <p className="text-[11px] leading-relaxed text-white/35">
              Kết quả tìm ở cột trái. Bấm + trên thẻ sticker để{" "}
              <code className="text-white/50">add_sticker</code>.
            </p>
          </aside>
        }
      />
    </div>
  );
}
