import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import type {
  TransitionItem,
  TransitionsAnimMode,
  TransitionsCategoryId,
} from "../../types";
import { TransitionsLibrary } from "./TransitionsLibrary";
import { TransitionsSidebar } from "./TransitionsSidebar";
import { useCapCutMate } from "../../api/CapCutMateContext";
import * as local from "../../api/capcutLocalClient";
import { loadTransitions } from "../../api/beCatalog";
import {
  listSegmentIds,
  requireLocalProject,
  secToUs,
} from "../../api/localApplyHelpers";
import { PanelGuide } from "../../shared/PanelGuide";
import { ResizableSplit } from "../../shared/ResizableSplit";

export function TransitionsPanel() {
  const mate = useCapCutMate();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<TransitionsCategoryId>("all");
  const [library, setLibrary] = useState<TransitionItem[]>([]);
  const [loadingLib, setLoadingLib] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<TransitionItem[]>([]);
  const [durationSec, setDurationSec] = useState(0.8);
  const [animMode, setAnimMode] = useState<TransitionsAnimMode>("alternate");
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingLib(true);
      setLoadError(null);
      try {
        const items = await loadTransitions();
        if (cancelled) return;
        setLibrary(
          items.map((t) => ({
            id: t.id,
            name: t.name,
            thumb: t.thumb,
          })),
        );
        if (!items.length) setLoadError("BE /enums transitions trống");
      } catch (e) {
        if (!cancelled) {
          setLibrary([]);
          setLoadError(e instanceof Error ? e.message : "Lỗi load transitions");
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
      if (safeLib.some((t) => t.id === id)) favorites += 1;
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

  const toggleFavorite = (id: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addItem = (item: TransitionItem) => {
    setSelected((prev) => {
      if (prev.some((t) => t.id === item.id)) {
        toast("Already in Selected Transitions");
        return prev;
      }
      return [...prev, item];
    });
  };

  const removeItem = (id: string) => {
    setSelected((prev) => prev.filter((t) => t.id !== id));
  };

  const clearSelected = () => setSelected([]);

  const handleApply = async () => {
    if (!selected.length) {
      toast.error("Chọn ít nhất 1 chuyển cảnh");
      return;
    }
    setApplying(true);
    try {
      const project = requireLocalProject(mate.localProject);
      const ids = await listSegmentIds(project, "video");
      if (!ids.length) {
        toast.error("Draft local không có segment video — kiểm tra path");
        return;
      }
      const durationUs = secToUs(durationSec);
      let n = 0;
      const names = selected.map((t) => t.name);
      for (let i = 0; i < ids.length; i++) {
        let name: string;
        if (animMode === "randomize") {
          name = names[Math.floor(Math.random() * names.length)];
        } else {
          name = names[i % names.length];
        }
        await local.localTransition(project, ids[i], name, durationUs);
        n += 1;
        if (!replaceExisting && selected.length === 1) break;
      }
      toast.success(
        `Đã áp dụng chuyển cảnh lên ${n} segment (local /transition)`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Áp dụng chuyển cảnh thất bại");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PanelGuide
        what="Gắn hiệu ứng chuyển giữa các clip video (fade, wipe, zoom…) trên project CapCut."
        how="① Draft local → lưu path · ② chọn transition (+) · ③ duration / alternate · ④ Apply."
        need={
          mate.localProject.trim()
            ? `Path: ${mate.localProject}`
            : "Path draft CapCut — menu «Draft local» → Lưu path."
        }
        tone={mate.localProject.trim() ? "default" : "warn"}
      />
      {loadingLib && (
        <div className="border-b border-white/6 px-3 py-1 text-[11px] text-white/40">
          Đang tải transitions từ BE /local/enums…
        </div>
      )}
      <ResizableSplit
        storageKey="capcut-split-transitions"
        left={
          <TransitionsLibrary
            search={search}
            onSearchChange={setSearch}
            category={category}
            onCategoryChange={setCategory}
            transitions={filtered}
            counts={counts}
            favoriteIds={favoriteIds}
            onToggleFavorite={toggleFavorite}
            onAdd={addItem}
            emptyHint={loadError || "Không khớp search / BE trống"}
          />
        }
        right={
          <TransitionsSidebar
            selected={selected}
            onRemove={removeItem}
            onClear={clearSelected}
            durationSec={durationSec}
            onDurationChange={setDurationSec}
            animMode={animMode}
            onAnimModeChange={setAnimMode}
            replaceExisting={replaceExisting}
            onReplaceExistingChange={setReplaceExisting}
            onApply={() => void handleApply()}
          />
        }
      />
      {applying && (
        <div className="border-t border-white/6 px-3 py-1 text-center text-[11px] text-indigo-300/80">
          Đang gọi local/transition…
        </div>
      )}
    </div>
  );
}
