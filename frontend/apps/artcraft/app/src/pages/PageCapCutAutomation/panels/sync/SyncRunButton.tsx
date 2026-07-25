import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlay } from "@fortawesome/pro-solid-svg-icons";
import { twMerge } from "tailwind-merge";

interface SyncRunButtonProps {
  isRunning: boolean;
  onClick: () => void;
  className?: string;
  size?: "md" | "lg";
}

export function SyncRunButton({
  isRunning,
  onClick,
  className,
  size = "lg",
}: SyncRunButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isRunning}
      className={twMerge(
        "flex items-center justify-center rounded-full bg-gradient-to-b from-cyan-300 to-cyan-500 font-bold tracking-wide text-[#0b1a1f] shadow-lg shadow-cyan-500/25 transition hover:brightness-110",
        size === "lg" ? "h-14 w-14 text-sm" : "h-12 w-12 text-xs",
        isRunning && "opacity-70",
        className,
      )}
    >
      {isRunning ? (
        <FontAwesomeIcon icon={faPlay} className="animate-pulse" />
      ) : (
        "RUN"
      )}
    </button>
  );
}
