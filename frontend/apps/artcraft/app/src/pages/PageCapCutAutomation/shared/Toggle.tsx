import { twMerge } from "tailwind-merge";

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <label className="flex cursor-pointer items-center gap-3 select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={twMerge(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-sky-400" : "bg-white/15",
        )}
      >
        <span
          className={twMerge(
            "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-4" : "translate-x-0",
          )}
        />
      </button>
      <span className="text-[13px] text-white/85">{label}</span>
    </label>
  );
}
