import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import type {
  FilterItem,
  FiltersApplyMode,
  FiltersCategoryId,
} from "../../types";
import { FiltersLibrary } from "./FiltersLibrary";
import { FiltersSidebar } from "./FiltersSidebar";
import { useCapCutMate } from "../../api/CapCutMateContext";
import * as api from "../../api/capcutBeClient";
import * as local from "../../api/capcutLocalClient";
import { loadMateFilters } from "../../api/beCatalog";
import { PanelGuide } from "../../shared/PanelGuide";
import { ResizableSplit } from "../../shared/ResizableSplit";

export function FiltersPanel() {
  const mate = useCapCutMate();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<FiltersCategoryId>("all");
  const [library, setLibrary] = useState<FilterItem[]>([]);
  const [loadingLib, setLoadingLib] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<FilterItem[]>([]);
  const [applyMode, setApplyMode] = useState<FiltersApplyMode>("all-clips");
  const [intensity, setIntensity] = useState(100);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingLib(true);
      setLoadError(null);
      try {
        const items = await loadMateFilters();
        if (cancelled) return;
        setLibrary(
          items.map((f) => ({
            id: f.id,
            name: f.name,
            thumb: f.thumb,
          })),
        );
        if (!items.length) setLoadError("BE trả 0 filters");
      } catch (e) {
        if (!cancelled) {
          setLibrary([]);
          setLoadError(e instanceof Error ? e.message : "Lỗi get_filters");
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
    let favorites = 0;
    favoriteIds.forEach((id) => {
      if (safeLib.some((f) => f.id === id)) favorites += 1;
    });
    return { all: safeLib.length, favorites };
  }, [library, favoriteIds]);

  const filtered = useMemo(() => {
    const safeLib = Array.isArray(library) ? library : [];
    const q = search.trim().toLowerCase();
    return safeLib.filter((item) => {
      if (category === "favorites" && !favoriteIds.has(item.id)) return false;
      if (q && !item.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, category, favoriteIds, library]);

  const handleApply = async () => {
    if (!selected.length) {
      toast.error("Chọn ít nhất 1 bộ lọc");
      return;
    }
    setApplying(true);
    try {
      const end = Math.max(mate.timelineEndUs, 5 * api.US);
      const infos = selected.map((f, i) => {
        if (applyMode === "all-clips") {
          return { filter_title: f.name, start: 0, end, intensity };
        }
        const slice = Math.floor(end / selected.length) || api.US;
        const start = i * slice;
        return {
          filter_title: f.name,
          start,
          end: Math.min(end, start + slice),
          intensity,
        };
      });
      if (mate.localProject && !mate.draftUrl) {
        for (const f of selected) {
          await local.localAddFilterLocal(mate.localProject, {
            name: f.name,
            start_us: 0,
            duration_us: end,
            intensity,
          });
        }
        toast.success(`Đã áp dụng ${selected.length} bộ lọc vào draft local ${mate.localProject.split(/[/\\]/).filter(Boolean).pop()}`);
      } else {
        const draftUrl = mate.ensureDraft();
        await api.addFilters(draftUrl, infos);
        toast.success(`Đã áp dụng ${selected.length} bộ lọc qua BE`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Thêm bộ lọc thất bại");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PanelGuide
        what="Bộ lọc màu từ get_filters — Apply → add_filters."
        how="① Tạo draft · ② chọn filter · ③ intensity · ④ Apply."
        need={
          mate.draftUrl
            ? `Draft OK · ${library.length} filters BE`
            : "Draft mate — «Tạo draft»."
        }
        tone={mate.draftUrl ? "default" : "warn"}
      />
      {loadingLib && (
        <div className="border-b border-white/6 px-3 py-1 text-[11px] text-white/40">
          Đang tải get_filters…
        </div>
      )}
      {loadError && !loadingLib && (
        <div className="border-b border-rose-500/20 bg-rose-500/5 px-3 py-1 text-[11px] text-rose-200/80">
          {loadError}
        </div>
      )}
      <ResizableSplit
        storageKey="capcut-split-filters"
        defaultWidth={340}
        left={
          <FiltersLibrary
            search={search}
            onSearchChange={setSearch}
            category={category}
            onCategoryChange={setCategory}
            filters={filtered}
            counts={counts}
            favoriteIds={favoriteIds}
            onToggleFavorite={(id) =>
              setFavoriteIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            onAdd={(item) =>
              setSelected((prev) =>
                prev.some((f) => f.id === item.id) ? prev : [...prev, item],
              )
            }
            emptyHint={loadError || "Không có filter từ BE / không khớp search"}
          />
        }
        right={
          <FiltersSidebar
            selected={selected}
            onRemove={(id) =>
              setSelected((prev) => prev.filter((f) => f.id !== id))
            }
            onClear={() => setSelected([])}
            applyMode={applyMode}
            onApplyModeChange={setApplyMode}
            intensity={intensity}
            onIntensityChange={setIntensity}
            replaceExisting={replaceExisting}
            onReplaceExistingChange={setReplaceExisting}
            onApply={() => void handleApply()}
          />
        }
      />
      {applying && (
        <div className="sr-only" aria-live="polite">
          Applying filters…
        </div>
      )}
    </div>
  );
}
