import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBackward,
  faForward,
  faPlay,
} from "@fortawesome/pro-solid-svg-icons";
import { SyncRunButton } from "./SyncRunButton";

interface SyncTransportBarProps {
  isRunning: boolean;
  onRun: () => void;
}

export function SyncTransportBar({ isRunning, onRun }: SyncTransportBarProps) {
  return (
    <div className="relative flex shrink-0 items-center gap-4 border-t border-white/8 bg-[#121317] px-5 py-3">
      <div className="flex flex-1 items-center gap-3">
        <span className="font-mono text-[11px] text-white/40">0:00</span>
        <input
          type="range"
          min={0}
          max={100}
          defaultValue={0}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-sky-500"
        />
        <span className="font-mono text-[11px] text-white/40">0:00</span>
      </div>

      <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-4 text-white/45">
        <button type="button" className="hover:text-white/80" title="Back 10s">
          <FontAwesomeIcon icon={faBackward} />
        </button>
        <button type="button" className="hover:text-white/80" title="Play">
          <FontAwesomeIcon icon={faPlay} />
        </button>
        <button type="button" className="hover:text-white/80" title="Fwd 10s">
          <FontAwesomeIcon icon={faForward} />
        </button>
      </div>

      <SyncRunButton isRunning={isRunning} onClick={onRun} size="md" />
    </div>
  );
}
