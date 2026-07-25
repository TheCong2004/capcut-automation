import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import type {
  KeyframeApplyMode,
  KeyframeTemplate,
} from "../../types";
import {
  KeyframeEditor,
  type KeyframeEditorState,
} from "./KeyframeEditor";
import { KeyframeLibrary } from "./KeyframeLibrary";
import { KeyframeSidebar } from "./KeyframeSidebar";
import { useCapCutMate } from "../../api/CapCutMateContext";
import * as api from "../../api/capcutBeClient";
import * as local from "../../api/capcutLocalClient";
import {
  listSegmentIds,
  requireLocalProject,
  secToUs,
} from "../../api/localApplyHelpers";
import { PanelGuide } from "../../shared/PanelGuide";
import { ResizableSplit } from "../../shared/ResizableSplit";

const DEFAULT_EDITOR: KeyframeEditorState = {
  templateName: "",
  unit: "percent",
  duration: 0,
  scaleW: 100,
  scaleH: 100,
  uniformScale: false,
  posX: 0,
  posY: 0,
  rotate: 0,
};

/** UI scale 100% → mate/local scale 1.0 */
function scaleVal(pct: number) {
  return pct / 100;
}

export function KeyframePanel() {
  const mate = useCapCutMate();
  const [search, setSearch] = useState("");
  const [templates, setTemplates] = useState<KeyframeTemplate[]>([]);
  const [selected, setSelected] = useState<KeyframeTemplate[]>([]);
  const [editor, setEditor] = useState<KeyframeEditorState>(DEFAULT_EDITOR);

  const [applyMode, setApplyMode] = useState<KeyframeApplyMode>("all");
  const [customRange, setCustomRange] = useState("");
  const [applyOrder, setApplyOrder] = useState("Alternate");
  const [timelineUnit, setTimelineUnit] = useState("Use template");
  const [templateLonger, setTemplateLonger] = useState("Scale to fit");
  const [clipLonger, setClipLonger] = useState("No stretch");
  const [offsetStart, setOffsetStart] = useState(0);
  const [applying, setApplying] = useState(false);
  /** Optional: mate segment ids (comma). Local dùng listSegmentIds. */
  const [mateSegmentIds, setMateSegmentIds] = useState("");

  const selectedIds = useMemo(
    () => new Set(selected.map((s) => s.id)),
    [selected],
  );

  const saveTemplate = () => {
    const name = editor.templateName.trim() || `Template ${templates.length + 1}`;
    const t: KeyframeTemplate = {
      id: `kf-${Date.now()}`,
      name,
      duration: editor.duration,
      scaleW: editor.scaleW,
      scaleH: editor.scaleH,
      uniformScale: editor.uniformScale,
      posX: editor.posX,
      posY: editor.posY,
      rotate: editor.rotate,
    };
    setTemplates((prev) => [t, ...prev]);
    setEditor((e) => ({ ...e, templateName: "" }));
    toast.success(`Đã lưu template “${name}”`);
  };

  const importTemplate = () => {
    const t: KeyframeTemplate = {
      id: `kf-import-${Date.now()}`,
      name: `Imported KF ${templates.length + 1}`,
      duration: 50,
      scaleW: 100,
      scaleH: 100,
      uniformScale: true,
      posX: 0,
      posY: 0,
      rotate: 0,
    };
    setTemplates((prev) => [t, ...prev]);
    toast.success("Đã import template mẫu");
  };

  const handleApply = async () => {
    const list = selected.length
      ? selected
      : [
          {
            id: "editor",
            name: editor.templateName || "Editor",
            duration: editor.duration,
            scaleW: editor.scaleW,
            scaleH: editor.scaleH,
            uniformScale: editor.uniformScale,
            posX: editor.posX,
            posY: editor.posY,
            rotate: editor.rotate,
          } satisfies KeyframeTemplate,
        ];

    setApplying(true);
    try {
      // Prefer local draft if path set
      if (mate.localProject.trim()) {
        const project = requireLocalProject(mate.localProject);
        let ids = await listSegmentIds(project, "video");
        if (applyMode === "custom" && customRange.trim()) {
          const pick = customRange
            .split(/[,\s]+/)
            .map((x) => x.trim())
            .filter(Boolean);
          if (pick.length) ids = pick;
        }
        if (!ids.length) {
          toast.error("Không có segment video trên draft local");
          return;
        }
        let applied = 0;
        for (const sid of ids) {
          const tpl = list[applied % list.length];
          const off0 = secToUs(offsetStart);
          const off1 = off0 + secToUs(Math.max(0.01, tpl.duration || 1));
          // start keyframe (identity-ish) + end from template
          await local.localKeyframe(
            project,
            sid,
            "KFTypeScaleX",
            off0,
            1,
          );
          await local.localKeyframe(
            project,
            sid,
            "KFTypeScaleX",
            off1,
            scaleVal(tpl.scaleW),
          );
          await local.localKeyframe(
            project,
            sid,
            "KFTypeScaleY",
            off0,
            1,
          );
          await local.localKeyframe(
            project,
            sid,
            "KFTypeScaleY",
            off1,
            scaleVal(tpl.uniformScale ? tpl.scaleW : tpl.scaleH),
          );
          await local.localKeyframe(
            project,
            sid,
            "KFTypePositionX",
            off1,
            tpl.posX / 100,
          );
          await local.localKeyframe(
            project,
            sid,
            "KFTypePositionY",
            off1,
            tpl.posY / 100,
          );
          await local.localKeyframe(
            project,
            sid,
            "KFTypeRotation",
            off1,
            tpl.rotate,
          );
          applied += 1;
        }
        toast.success(
          `Đã ghi keyframe local lên ${applied} segment (/keyframe)`,
        );
        return;
      }

      // Mate draft path
      const draftUrl = mate.ensureDraft();
      const segs = mateSegmentIds
        .split(/[,\s]+/)
        .map((x) => x.trim())
        .filter(Boolean);
      if (!segs.length) {
        toast.error(
          "Draft mate: nhập segment_id (cách nhau dấu phẩy) — hoặc set path local",
        );
        return;
      }
      const keyframes: Array<Record<string, unknown>> = [];
      for (const sid of segs) {
        const tpl = list[0];
        keyframes.push(
          {
            segment_id: sid,
            property: "KFTypeScaleX",
            offset: 0,
            value: 1,
          },
          {
            segment_id: sid,
            property: "KFTypeScaleX",
            offset: 1,
            value: scaleVal(tpl.scaleW),
          },
          {
            segment_id: sid,
            property: "KFTypeScaleY",
            offset: 1,
            value: scaleVal(tpl.uniformScale ? tpl.scaleW : tpl.scaleH),
          },
          {
            segment_id: sid,
            property: "KFTypePositionX",
            offset: 1,
            value: tpl.posX / 100,
          },
          {
            segment_id: sid,
            property: "KFTypePositionY",
            offset: 1,
            value: tpl.posY / 100,
          },
          {
            segment_id: sid,
            property: "KFTypeRotation",
            offset: 1,
            value: tpl.rotate,
          },
        );
      }
      await api.addKeyframes(draftUrl, keyframes);
      toast.success(
        `Đã add_keyframes mate · ${keyframes.length} KF · ${applyOrder}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Áp dụng keyframe thất bại");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PanelGuide
        what="Tạo / áp keyframe scale, vị trí, xoay cho clip (animate chuyển động)."
        how="① Chỉnh editor hoặc chọn template · ② Apply. Ưu tiên draft local; mate cần segment_id."
        need={
          mate.localProject.trim()
            ? "Mode local /keyframe — path đã có."
            : mate.draftUrl
              ? "Mode mate — nhập segment_id bên dưới."
              : "Draft local (path) hoặc draft mate + segment_id."
        }
        tone={
          mate.localProject.trim() || mate.draftUrl ? "default" : "warn"
        }
      />
      <div className="flex flex-wrap items-center gap-2 border-b border-white/8 bg-[#15161a] px-3 py-2">
        <span className="text-[11px] text-white/45">
          {mate.localProject.trim()
            ? "Mode: local /keyframe"
            : "Mode: mate add_keyframes — segment_id:"}
        </span>
        {!mate.localProject.trim() && (
          <input
            value={mateSegmentIds}
            onChange={(e) => setMateSegmentIds(e.target.value)}
            placeholder="seg-id-1, seg-id-2"
            className="min-w-[180px] flex-1 rounded-lg border border-white/10 bg-[#252830] px-3 py-1.5 font-mono text-[11px] text-white outline-none focus:border-cyan-400/40"
          />
        )}
        {mate.localProject.trim() && (
          <span className="truncate font-mono text-[10px] text-emerald-300/70">
            {mate.localProject}
          </span>
        )}
      </div>
      <ResizableSplit
        storageKey="capcut-split-keyframe"
        defaultWidth={320}
        left={
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-[#1a1b1f]">
            <div className="flex min-h-0 flex-1 flex-col">
              <KeyframeLibrary
                search={search}
                onSearchChange={setSearch}
                templates={templates}
                selectedIds={selectedIds}
                onImport={importTemplate}
                onAdd={(t) =>
                  setSelected((prev) =>
                    prev.some((x) => x.id === t.id) ? prev : [...prev, t],
                  )
                }
                onRemove={(id) =>
                  setSelected((prev) => prev.filter((x) => x.id !== id))
                }
              />
            </div>
            <div className="flex max-h-[55%] min-h-[280px] flex-col">
              <KeyframeEditor
                state={editor}
                onChange={(patch) => setEditor((s) => ({ ...s, ...patch }))}
                onSave={saveTemplate}
              />
            </div>
          </div>
        }
        right={
          <KeyframeSidebar
            selected={selected}
            onRemove={(id) =>
              setSelected((prev) => prev.filter((x) => x.id !== id))
            }
            onClear={() => setSelected([])}
            applyMode={applyMode}
            onApplyModeChange={setApplyMode}
            customRange={customRange}
            onCustomRangeChange={setCustomRange}
            applyOrder={applyOrder}
            onApplyOrderChange={setApplyOrder}
            timelineUnit={timelineUnit}
            onTimelineUnitChange={setTimelineUnit}
            templateLonger={templateLonger}
            onTemplateLongerChange={setTemplateLonger}
            clipLonger={clipLonger}
            onClipLongerChange={setClipLonger}
            offsetStart={offsetStart}
            onOffsetStartChange={setOffsetStart}
            onApply={() => void handleApply()}
          />
        }
      />
      {applying && (
        <div className="border-t border-white/6 px-3 py-1 text-center text-[11px] text-cyan-300/80">
          Đang ghi keyframe…
        </div>
      )}
    </div>
  );
}
