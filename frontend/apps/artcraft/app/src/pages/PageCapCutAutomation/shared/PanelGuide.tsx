import { twMerge } from "tailwind-merge";

interface PanelGuideProps {
  /** Một dòng: mục này để làm gì */
  what: string;
  /** Cách dùng ngắn (①②③…) */
  how: string;
  /** Cảnh báo / điều kiện (vd: cần draft mate / local) */
  need?: string;
  /** warn = vàng khi thiếu path/draft */
  tone?: "default" | "warn";
  className?: string;
}

/** Hướng dẫn nhỏ thống nhất trên mọi panel CapCut Automation. */
export function PanelGuide({
  what,
  how,
  need,
  tone = "default",
  className,
}: PanelGuideProps) {
  return (
    <div
      className={twMerge(
        "shrink-0 border-b px-3 py-2 text-[11px] leading-relaxed",
        tone === "warn"
          ? "border-amber-500/20 bg-amber-500/5 text-amber-100/85"
          : "border-white/6 bg-[#121318] text-white/45",
        className,
      )}
    >
      <p>
        <span className="font-medium text-white/65">Mục này: </span>
        {what}
      </p>
      <p className="mt-0.5">
        <span className="font-medium text-white/65">Cách dùng: </span>
        {how}
      </p>
      {need ? (
        <p
          className={twMerge(
            "mt-0.5",
            tone === "warn" ? "text-amber-200/90" : "text-white/40",
          )}
        >
          <span className="font-medium text-white/55">Cần: </span>
          {need}
        </p>
      ) : null}
    </div>
  );
}
