import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import type {
  AnimationItem,
  AnimationsCategoryId,
  AnimationsDurationUnit,
  AnimationsTargetScope,
} from "../../types";
import { AnimationsLibrary } from "./AnimationsLibrary";
import { AnimationsSidebar } from "./AnimationsSidebar";
import { useCapCutMate } from "../../api/CapCutMateContext";
import * as local from "../../api/capcutLocalClient";
import { loadAnimations } from "../../api/beCatalog";
import {
  listSegmentIds,
  requireLocalProject,
  secToUs,
} from "../../api/localApplyHelpers";
import { PanelGuide } from "../../shared/PanelGuide";
import { ResizableSplit } from "../../shared/ResizableSplit";

export function AnimationsPanel() {
  const mate = useCapCutMate();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<AnimationsCategoryId>("in");
  const [library, setLibrary] = useState<AnimationItem[]>([]);
  const [loadingLib, setLoadingLib] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<AnimationItem[]>([]);
  const [durationUnit, setDurationUnit] =
    useState<AnimationsDurationUnit>("seconds");
  const [inDuration, setInDuration] = useState(1);
  const [outDuration, setOutDuration] = useState(1);
  const [comboStart, setComboStart] = useState(2);
  const [comboEnd, setComboEnd] = useState(5);
  const [targetScope, setTargetScope] =
    useState<AnimationsTargetScope>("all-clips");
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingLib(true);
      setLoadError(null);
      try {
        const items = await loadAnimations();
        if (cancelled) return;
        setLibrary(
          items.map((a) => ({
            id: a.id,
            name: a.name,
            category: a.category,
            thumb: a.thumb,
          })),
        );
        if (!items.length) setLoadError("BE không trả animation");
      } catch (e) {
        if (!cancelled) {
          setLibrary([]);
          setLoadError(e instanceof Error ? e.message : "Lỗi load animations");
        }
      } finally {
        if (!cancelled) setLoadingLib(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(
    () => {
      const safeLib = Array.isArray(library) ? library : [];
      return {
        in: safeLib.filter((a) => a.category === "in").length,
        out: safeLib.filter((a) => a.category === "out").length,
        combo: safeLib.filter((a) => a.category === "combo").length,
      };
    },
    [library],
  );

  const filtered = useMemo(() => {
    const safeLib = Array.isArray(library) ? library : [];
    const q = search.trim().toLowerCase();
    return safeLib.filter((item) => {
      if (item.category !== category) return false;
      if (q && !item.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, category, library]);

  const selectedIds = useMemo(
    () => new Set(selected.map((s) => s.id)),
    [selected],
  );

  const toggleFavorite = (id: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addItem = (item: AnimationItem) => {
    setSelected((prev) => {
      if (prev.some((a) => a.id === item.id)) return prev;
      return [...prev, item];
    });
  };

  const removeItem = (id: string) => {
    setSelected((prev) => prev.filter((a) => a.id !== id));
  };

  const handleApply = async () => {
    if (!selected.length) {
      toast.error("Chọn ít nhất 1 hoạt ảnh");
      return;
    }
    setApplying(true);
    try {
      const project = requireLocalProject(mate.localProject);
      let ids = await listSegmentIds(project, "video");
      if (!ids.length) ids = await listSegmentIds(project, "all");
      if (!ids.length) {
        toast.error("Không có segment để gắn hoạt ảnh");
        return;
      }
      if (targetScope === "first-clip") ids = ids.slice(0, 1);

      const introUs = secToUs(durationUnit === "seconds" ? inDuration : inDuration / 100);
      const outroUs = secToUs(durationUnit === "seconds" ? outDuration : outDuration / 100);
      const comboUs = secToUs(
        durationUnit === "seconds"
          ? Math.max(0.1, comboEnd - comboStart)
          : Math.max(0.1, (comboEnd - comboStart) / 100),
      );

      const intros = selected.filter((a) => a.category === "in").map((a) => a.name);
      const outros = selected.filter((a) => a.category === "out").map((a) => a.name);
      const combos = selected.filter((a) => a.category === "combo").map((a) => a.name);
      // If user only picked from current tab, treat all as that category
      const allNames = selected.map((a) => a.name);
      const introName = intros[0] ?? (category === "in" ? allNames[0] : undefined);
      const outroName = outros[0] ?? (category === "out" ? allNames[0] : undefined);
      const comboName = combos[0] ?? (category === "combo" ? allNames[0] : undefined);

      let n = 0;
      for (const sid of ids) {
        await local.localImageAnim(project, sid, {
          ...(introName ? { intro: introName, intro_duration_us: introUs } : {}),
          ...(outroName ? { outro: outroName, outro_duration_us: outroUs } : {}),
          ...(comboName ? { combo: comboName, combo_duration_us: comboUs } : {}),
          ...(replaceExisting ? {} : {}),
        });
        n += 1;
      }
      toast.success(`Đã gắn hoạt ảnh lên ${n} segment (local /image-anim)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Áp dụng hoạt ảnh thất bại");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PanelGuide
        what="Gắn hoạt ảnh in/out/combo cho clip video/ảnh trên draft CapCut local."
        how="① Draft local → path · ② chọn In/Out/Combo · ③ duration · ④ Apply → image-anim."
        need={
          mate.localProject.trim()
            ? `Path: ${mate.localProject}`
            : "Path draft CapCut — menu «Draft local»."
        }
        tone={mate.localProject.trim() ? "default" : "warn"}
      />
      {loadingLib && (
        <div className="border-b border-white/6 px-3 py-1 text-[11px] text-white/40">
          Đang tải danh sách hoạt ảnh từ BE…
        </div>
      )}
      <ResizableSplit
        storageKey="capcut-split-animations"
        left={
          <AnimationsLibrary
            search={search}
            onSearchChange={setSearch}
            category={category}
            onCategoryChange={setCategory}
            animations={filtered}
            counts={counts}
            favoriteIds={favoriteIds}
            selectedIds={selectedIds}
            onToggleFavorite={toggleFavorite}
            onAdd={addItem}
            onRemove={removeItem}
            emptyHint={loadError || "Không có animation từ BE / không khớp"}
          />
        }
        right={
          <AnimationsSidebar
            selected={selected}
            onRemove={removeItem}
            onClear={() => setSelected([])}
            durationUnit={durationUnit}
            onDurationUnitChange={setDurationUnit}
            inDuration={inDuration}
            outDuration={outDuration}
            onInDurationChange={setInDuration}
            onOutDurationChange={setOutDuration}
            comboStart={comboStart}
            comboEnd={comboEnd}
            onComboStartChange={setComboStart}
            onComboEndChange={setComboEnd}
            targetScope={targetScope}
            onTargetScopeChange={setTargetScope}
            replaceExisting={replaceExisting}
            onReplaceExistingChange={setReplaceExisting}
            onApply={() => void handleApply()}
          />
        }
      />
      {applying && (
        <div className="border-t border-white/6 px-3 py-1 text-center text-[11px] text-amber-300/80">
          Đang gọi local/image-anim…
        </div>
      )}
    </div>
  );
}
