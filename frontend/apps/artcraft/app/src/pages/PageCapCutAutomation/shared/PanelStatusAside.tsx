import { useCapCutMate } from "../api/CapCutMateContext";

/** Cột phải gọn: trạng thái draft mate / local — để mọi mục 1 cột vẫn kéo thu phóng được. */
export function PanelStatusAside({ tip }: { tip?: string }) {
  const mate = useCapCutMate();
  return (
    <aside className="flex h-full min-h-0 w-full flex-col gap-3 overflow-y-auto border-l border-white/8 bg-[#16171b] px-4 py-4">
      <h3 className="text-[13px] font-semibold text-white/85">Trạng thái</h3>
      <div className="space-y-2 text-[11px] leading-relaxed text-white/45">
        <div>
          <div className="text-white/35">BE</div>
          <div className="font-mono text-white/70">
            {mate.online === true
              ? "online"
              : mate.online === false
                ? "offline"
                : "…"}
          </div>
        </div>
        <div>
          <div className="text-white/35">Draft mate</div>
          <div className="break-all font-mono text-[10px] text-sky-300/80">
            {mate.draftUrl
              ? mate.draftUrl.match(/draft_id=([^&]+)/)?.[1] || "có"
              : "chưa"}
          </div>
        </div>
        <div>
          <div className="text-white/35">Draft local</div>
          <div className="break-all font-mono text-[10px] text-emerald-300/80">
            {mate.localProject.trim() || "chưa"}
          </div>
        </div>
        <div>
          <div className="text-white/35">Timeline</div>
          <div className="text-white/70">
            {(mate.timelineEndUs / 1_000_000).toFixed(2)}s
          </div>
        </div>
        {tip ? <p className="border-t border-white/8 pt-2 text-white/40">{tip}</p> : null}
      </div>
      <p className="mt-auto text-[10px] text-white/25">
        Kéo mép giữa cột để thu phóng panel
      </p>
    </aside>
  );
}
