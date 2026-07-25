import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import type { AdjustmentSliders, LutItem } from "../../types";
import { AdjustmentSidebar } from "./AdjustmentSidebar";
import { LutLibrary } from "./LutLibrary";
import { useCapCutMate } from "../../api/CapCutMateContext";
import * as api from "../../api/capcutBeClient";
import * as local from "../../api/capcutLocalClient";
import { loadMateFilters } from "../../api/beCatalog";
import { requireLocalProject } from "../../api/localApplyHelpers";
import { PanelGuide } from "../../shared/PanelGuide";
import { ResizableSplit } from "../../shared/ResizableSplit";

const DEFAULT_SLIDERS: AdjustmentSliders = {
  sharpen: 0,
  clarity: 0,
  particles: 0,
  fade: 0,
  vignette: 0,
};

export function AdjustmentPanel() {
  const mate = useCapCutMate();
  const [search, setSearch] = useState("");
  const [luts, setLuts] = useState<LutItem[]>([]);
  const [selected, setSelected] = useState<LutItem[]>([]);
  const [sliders, setSliders] = useState<AdjustmentSliders>(DEFAULT_SLIDERS);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [applying, setApplying] = useState(false);
  const [loadingLib, setLoadingLib] = useState(false);

  // Auto-load filters từ BE (dùng như LUT list) — không mock
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingLib(true);
      try {
        const items = await loadMateFilters();
        if (cancelled) return;
        setLuts(
          items.map((f) => ({
            id: f.id,
            name: f.name,
            thumb: f.thumb,
          })),
        );
      } catch {
        if (!cancelled) setLuts([]);
      } finally {
        if (!cancelled) setLoadingLib(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedIds = useMemo(
    () => new Set(selected.map((s) => s.id)),
    [selected],
  );

  const addLut = (item: LutItem) => {
    setSelected((prev) => {
      if (prev.some((l) => l.id === item.id)) return prev;
      return [...prev, item];
    });
  };

  const removeLut = (id: string) => {
    setSelected((prev) => prev.filter((l) => l.id !== id));
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      // Prefer mate draft filters (LUT names as filter_title)
      if (mate.draftUrl && selected.length) {
        const draftUrl = mate.ensureDraft();
        const end = Math.max(mate.timelineEndUs, 5 * api.US);
        const intensity = Math.max(
          1,
          Math.round(
            100 -
              (sliders.fade + sliders.vignette) / 2 +
              sliders.clarity / 4,
          ),
        );
        await api.addFilters(
          draftUrl,
          selected.map((lut) => ({
            filter_title: lut.name,
            start: 0,
            end,
            intensity: Math.min(100, Math.max(0, intensity)),
          })),
        );
        toast.success(
          `Đã add_filters ${selected.length} LUT/filter qua mate${replaceExisting ? "" : ""}`,
        );
        return;
      }

      // Local draft: add-filter per LUT
      if (mate.localProject.trim() && selected.length) {
        const project = requireLocalProject(mate.localProject);
        for (const lut of selected) {
          await local.localAddFilterLocal(project, {
            name: lut.name,
            start_us: 0,
            duration_us: Math.max(mate.timelineEndUs, 5 * api.US),
            intensity: Math.min(
              1,
              Math.max(0.1, (100 - sliders.fade) / 100),
            ),
          });
        }
        toast.success(`Đã local/add-filter · ${selected.length} LUT`);
        return;
      }

      if (!selected.length) {
        toast(
          `Sliders (sharpen ${sliders.sharpen}…) — BE chưa có API color grade thuần; chọn LUT + draft/mate để apply filter`,
        );
        return;
      }
      toast.error("Cần draft mate hoặc path local để apply LUT");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Apply chỉnh màu thất bại");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PanelGuide
        what="Chỉnh màu / LUT: map tên LUT thành filter trên draft mate hoặc local."
        how="① Download library (từ BE) · ② chọn LUT · ③ slider hỗ trợ intensity · ④ Apply."
        need="Ưu tiên draft mate; không có thì dùng path Draft local."
        tone={mate.draftUrl || mate.localProject.trim() ? "default" : "warn"}
      />
      {loadingLib && (
        <div className="border-b border-white/6 px-3 py-1 text-[11px] text-white/40">
          Đang tải get_filters từ BE…
        </div>
      )}
      {applying && (
        <div className="border-b border-white/6 px-3 py-1 text-center text-[11px] text-lime-300/80">
          Đang apply filter/LUT…
        </div>
      )}
      <ResizableSplit
        storageKey="capcut-split-adjustment"
        left={
          <LutLibrary
            search={search}
            onSearchChange={setSearch}
            luts={luts}
            selectedIds={selectedIds}
            onAdd={addLut}
            onRemove={removeLut}
            onDownloadLibrary={async () => {
              setLoadingLib(true);
              try {
                const items = await loadMateFilters();
                setLuts(
                  items.map((f) => ({
                    id: f.id,
                    name: f.name,
                    thumb: f.thumb,
                  })),
                );
                toast.success(
                  items.length
                    ? `Tải ${items.length} filter từ BE`
                    : "BE get_filters trống",
                );
              } catch (e) {
                setLuts([]);
                toast.error(e instanceof Error ? e.message : "Lỗi get_filters");
              } finally {
                setLoadingLib(false);
              }
            }}
            onImport={() => {
              const name = window.prompt(
                "Tên filter/LUT (phải khớp resource BE):",
                "",
              );
              if (!name?.trim()) return;
              const item: LutItem = {
                id: `custom-${Date.now()}`,
                name: name.trim(),
                thumb: "linear-gradient(135deg,#363b45,#484f5c)",
              };
              setLuts((prev) => [item, ...prev]);
              toast.success(`Đã thêm tên filter: ${item.name}`);
            }}
          />
        }
        right={
          <AdjustmentSidebar
            selected={selected}
            onRemove={removeLut}
            onClear={() => setSelected([])}
            sliders={sliders}
            onSliderChange={(key, value) =>
              setSliders((prev) => ({ ...prev, [key]: value }))
            }
            replaceExisting={replaceExisting}
            onReplaceExistingChange={setReplaceExisting}
            onApply={() => void handleApply()}
          />
        }
      />
    </div>
  );
}
