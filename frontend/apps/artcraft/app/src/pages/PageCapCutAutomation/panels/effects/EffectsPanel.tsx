import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import type {
  EffectItem,
  EffectsApplyMode,
  EffectsCategoryId,
} from "../../types";
import { EffectsLibrary } from "./EffectsLibrary";
import { EffectsSidebar } from "./EffectsSidebar";
import { useCapCutMate } from "../../api/CapCutMateContext";
import * as api from "../../api/capcutBeClient";
import * as local from "../../api/capcutLocalClient";
import { loadMateEffects } from "../../api/beCatalog";
import { PanelGuide } from "../../shared/PanelGuide";
import { ResizableSplit } from "../../shared/ResizableSplit";

export function EffectsPanel() {
  const mate = useCapCutMate();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<EffectsCategoryId>("all");
  const [library, setLibrary] = useState<EffectItem[]>([]);
  const [loadingLib, setLoadingLib] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<EffectItem[]>([]);
  const [activeSelectedId, setActiveSelectedId] = useState<string | null>(null);
  const [applyMode, setApplyMode] = useState<EffectsApplyMode>("all");
  const [timingPlacement, setTimingPlacement] = useState<
    "segment_start" | "segment_full" | "entire"
  >("segment_start");
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingLib(true);
      setLoadError(null);
      try {
        const items = await loadMateEffects();
        if (cancelled) return;
        const safeItems = Array.isArray(items) ? items : [];
        setLibrary(
          safeItems.map((e, idx) => ({
            id: String(e?.id || `fx-${idx}`),
            name: String(e?.name || "Effect"),
            category: "video" as const,
            thumb: String(e?.thumb || ""),
          })),
        );
        if (!safeItems.length) setLoadError("BE trả 0 effects");
      } catch (e) {
        if (!cancelled) {
          setLibrary([]);
          setLoadError(e instanceof Error ? e.message : "Lỗi get_effects");
        }
      } finally {
        if (!cancelled) setLoadingLib(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const safeLib = Array.isArray(library) ? library : [];
    const video = safeLib.filter((e) => e && e.category === "video").length;
    const body = safeLib.filter((e) => e && e.category === "body").length;
    let favorites = 0;
    favoriteIds.forEach((id) => {
      if (safeLib.some((e) => e && e.id === id)) favorites += 1;
    });
    return { all: safeLib.length, video, body, favorites };
  }, [library, favoriteIds]);

  const filtered = useMemo(() => {
    const safeLib = Array.isArray(library) ? library : [];
    const q = search.trim().toLowerCase();
    return safeLib.filter((effect) => {
      if (!effect || typeof effect !== "object") return false;
      if (category === "favorites") {
        if (!favoriteIds.has(effect.id)) return false;
      } else if (category !== "all" && effect.category !== category) {
        return false;
      }
      if (q && !(effect.name || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, category, favoriteIds, library]);

  const toggleFavorite = (id: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addEffect = (effect: EffectItem) => {
    setSelected((prev) => {
      if (prev.some((e) => e.id === effect.id)) {
        toast("Đã có trong Selected");
        return prev;
      }
      return [...prev, effect];
    });
    setActiveSelectedId(effect.id);
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      let end = Math.max(mate.timelineEndUs, 5 * api.US);
      if (mate.localProject && !mate.draftUrl) {
        try {
          const info = await local.localInfo(mate.localProject);
          const rawDur = (info as any)?.duration ?? (info as any)?.duration_us;
          if (typeof rawDur === "number" && rawDur > 0) {
            end = rawDur;
            mate.setTimelineEndUs(rawDur);
          }
        } catch {
          /* Fallback to default end */
        }

        if (replaceExisting || !selected.length) {
          await local.localRemoveEffect(mate.localProject, {});
        }

        let appliedBatchCount = 0;
        if (selected.length > 0) {
          const batchItems: {
            name: string;
            start_us: number;
            duration_us: number;
          }[] = [];

          if (
            timingPlacement === "segment_start" ||
            timingPlacement === "segment_full"
          ) {
            try {
              const segRes = await local.localSegments(
                mate.localProject,
                "video",
              );
              const segs = segRes.segments || [];
              if (segs.length > 0) {
                let itemsToApply = [...selected];
                if (applyMode === "randomize") {
                  itemsToApply = itemsToApply.sort(() => Math.random() - 0.5);
                }
                for (let i = 0; i < segs.length; i++) {
                  const s = segs[i];
                  const range = s.target_timerange || {};
                  const segStart =
                    typeof range.start === "number" ? range.start : 0;
                  const segDur =
                    typeof range.duration === "number"
                      ? range.duration
                      : 3_000_000;
                  const effectDur =
                    timingPlacement === "segment_start"
                      ? Math.min(3 * api.US, segDur) // 3s ở đầu mỗi đoạn cắt
                      : segDur; // Phủ toàn bộ đoạn cắt
                  const effect = itemsToApply[i % itemsToApply.length];
                  batchItems.push({
                    name: effect.name,
                    start_us: segStart,
                    duration_us: effectDur,
                  });
                }
              }
            } catch {
              /* Fallback if segments fetch fails */
            }
          }

          // Fallback nếu không lấy được segments hoặc khi chọn "entire"
          if (batchItems.length === 0) {
            if (applyMode === "all") {
              for (const e of selected) {
                batchItems.push({
                  name: e.name,
                  start_us: 0,
                  duration_us: end,
                });
              }
            } else {
              let itemsToApply = [...selected];
              if (applyMode === "randomize") {
                itemsToApply = itemsToApply.sort(() => Math.random() - 0.5);
              }
              const segDurUs = 5 * api.US; // 5s cho mỗi đoạn xen kẽ
              let currStart = 0;
              let idx = 0;
              while (currStart < end) {
                const dur = Math.min(segDurUs, end - currStart);
                const effect = itemsToApply[idx % itemsToApply.length];
                batchItems.push({
                  name: effect.name,
                  start_us: currStart,
                  duration_us: dur,
                });
                currStart += dur;
                idx++;
              }
            }
          }

          appliedBatchCount = batchItems.length;
          if (batchItems.length > 0) {
            await local.localAddEffectsBatchLocal(
              mate.localProject,
              batchItems,
            );
          }
        }

        const projName = mate.localProject
          .split(/[/\\]/)
          .filter(Boolean)
          .pop();
        if (!selected.length) {
          toast.success(`Đã xóa sạch hiệu ứng trong draft ${projName}`);
        } else if (timingPlacement === "segment_start") {
          toast.success(
            `Đã chèn hiệu ứng ở ĐẦU MỖI ĐOẠN CẮT (${appliedBatchCount} đoạn) trong draft ${projName}`,
          );
        } else if (timingPlacement === "segment_full") {
          toast.success(
            `Đã áp dụng hiệu ứng phủ trọn vẹn ${appliedBatchCount} đoạn cắt trong draft ${projName}`,
          );
        } else {
          toast.success(
            `Đã áp dụng hiệu ứng (${applyMode}) xen kẽ mỗi 5s suốt ${(end / 1_000_000).toFixed(1)}s video vào draft ${projName}`,
          );
        }
      } else {
        if (!selected.length) {
          toast.error("Chọn ít nhất 1 hiệu ứng");
          return;
        }
        const infos = selected.map((e, i) => {
          if (applyMode === "all") {
            return { effect_title: e.name, start: 0, end };
          }
          const slice = Math.floor(end / selected.length) || api.US;
          const start = i * slice;
          return {
            effect_title: e.name,
            start,
            end: Math.min(end, start + slice),
          };
        });
        const draftUrl = mate.ensureDraft();
        await api.addEffects(draftUrl, infos);
        toast.success(`Đã áp dụng ${selected.length} hiệu ứng qua BE`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Thao tác hiệu ứng thất bại");
    } finally {
      setApplying(false);
    }
  };

  useEffect(() => {
    if (!mate.localProject) return;
    let cancelled = false;
    (async () => {
      try {
        const info = await local.localInfo(mate.localProject);
        if (!cancelled && info && typeof info.duration === "number" && info.duration > 0) {
          mate.setTimelineEndUs(info.duration);
        }
        const res = await local.localGetProjectEffects(mate.localProject);
        if (cancelled) return;
        if (res && res.ok && Array.isArray(res.effects)) {
          const existingItems: EffectItem[] = res.effects
            .filter((fx) => fx && typeof fx === "object")
            .map((fx) => ({
              id: String(fx.id || Math.random()),
              name: String(fx.name || "Effect"),
              category: "video" as const,
            }));
          setSelected(existingItems);
        }
      } catch {
        /* Ignore error on uninitialized draft */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mate.localProject]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PanelGuide
        what="Thêm hiệu ứng video (fx) lên timeline draft mate — list từ get_effects."
        how="① Tạo draft · ② chọn effect (+) · ③ mode · ④ Apply → add_effects."
        need={
          mate.draftUrl
            ? `Draft mate OK · ${library.length} effects từ BE`
            : "Draft mate — «Tạo draft» trên thanh trên."
        }
        tone={mate.draftUrl ? "default" : "warn"}
      />
      {loadingLib && (
        <div className="border-b border-white/6 px-3 py-1 text-[11px] text-white/40">
          Đang tải get_effects từ BE…
        </div>
      )}
      {loadError && !loadingLib && (
        <div className="border-b border-rose-500/20 bg-rose-500/5 px-3 py-1 text-[11px] text-rose-200/80">
          {loadError}
        </div>
      )}
      <ResizableSplit
        storageKey="capcut-split-effects"
        left={
          <EffectsLibrary
            search={search}
            onSearchChange={setSearch}
            category={category}
            onCategoryChange={setCategory}
            effects={filtered}
            counts={counts}
            favoriteIds={favoriteIds}
            onToggleFavorite={toggleFavorite}
            onAdd={addEffect}
            emptyHint={
              loadError
                ? loadError
                : loadingLib
                  ? "Đang tải…"
                  : "Không khớp tìm kiếm / BE trống"
            }
          />
        }
        right={
          <EffectsSidebar
            selected={selected}
            activeSelectedId={activeSelectedId}
            onSelectItem={setActiveSelectedId}
            onRemove={async (id) => {
              const itemToRemove = selected.find((e) => e.id === id);
              setSelected((prev) => prev.filter((e) => e.id !== id));
              setActiveSelectedId((cur) => (cur === id ? null : cur));
              if (mate.localProject && itemToRemove) {
                try {
                  await local.localRemoveEffect(mate.localProject, {
                    name: itemToRemove.name,
                    material_id: itemToRemove.id,
                  });
                  toast.success(
                    `Đã xóa hiệu ứng ${itemToRemove.name} khỏi draft CapCut`,
                  );
                } catch {
                  toast.error("Xóa hiệu ứng thất bại");
                }
              }
            }}
            onClear={async () => {
              setSelected([]);
              setActiveSelectedId(null);
              if (mate.localProject) {
                try {
                  await local.localRemoveEffect(mate.localProject, {});
                  toast.success("Đã xóa tất cả hiệu ứng khỏi draft CapCut");
                } catch {
                  toast.error("Xóa tất cả hiệu ứng thất bại");
                }
              }
            }}
            applyMode={applyMode}
            onApplyModeChange={setApplyMode}
            timingPlacement={timingPlacement}
            onTimingPlacementChange={setTimingPlacement}
            replaceExisting={replaceExisting}
            onReplaceExistingChange={setReplaceExisting}
            onApply={() => void handleApply()}
          />
        }
      />
      {applying && (
        <div className="border-t border-white/6 px-3 py-1 text-center text-[11px] text-fuchsia-300/80">
          Đang gọi add_effects…
        </div>
      )}
    </div>
  );
}
