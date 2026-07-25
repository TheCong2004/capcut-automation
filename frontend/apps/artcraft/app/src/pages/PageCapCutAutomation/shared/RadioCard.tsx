import { twMerge } from "tailwind-merge";

interface RadioCardProps {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}

export function RadioCard({ selected, onSelect, children }: RadioCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={twMerge(
        "flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-[13px] transition-colors",
        selected
          ? "border-sky-400/40 bg-[#2a2d35] text-white"
          : "border-transparent bg-[#252830] text-white/80 hover:bg-[#2a2d35]",
      )}
    >
      <span
        className={twMerge(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-sky-400" : "border-white/30",
        )}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-sky-400" />}
      </span>
      {children}
    </button>
  );
}
