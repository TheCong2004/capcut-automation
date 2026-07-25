import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBackwardStep,
  faForwardStep,
  faMinus,
  faPlay,
  faPlus,
} from "@fortawesome/pro-solid-svg-icons";

export function CaptionTransport() {
  return (
    <div className="shrink-0 border-t border-white/8 bg-[#121317] px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-mono text-[12px] text-white/50">
          00:00:00:00{" "}
          <span className="text-white/25">/ 00:00:00:00</span>
        </div>
        <div className="flex items-center gap-3 text-white/50">
          <button type="button" className="hover:text-white/80" title="Previous">
            <FontAwesomeIcon icon={faBackwardStep} />
          </button>
          <button type="button" className="hover:text-white/80" title="Play">
            <FontAwesomeIcon icon={faPlay} />
          </button>
          <button type="button" className="hover:text-white/80" title="Next">
            <FontAwesomeIcon icon={faForwardStep} />
          </button>
        </div>
        <div className="flex items-center gap-2 text-white/45">
          <FontAwesomeIcon icon={faMinus} className="text-[10px]" />
          <input
            type="range"
            min={0}
            max={100}
            defaultValue={40}
            className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-white/15 accent-sky-500"
          />
          <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
        </div>
      </div>

      <div className="flex h-16 flex-col justify-center rounded-md border border-white/8 bg-[#0e0f12] px-3">
        <div className="mb-1 h-1.5 w-full rounded-full bg-white/10" />
        <div className="text-center text-[11px] text-white/25">
          Waveform preview
        </div>
        <div className="mt-1 h-1 w-full rounded-full bg-white/5" />
      </div>
    </div>
  );
}
