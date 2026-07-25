import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faChevronDown,
  faScissors,
} from "@fortawesome/pro-solid-svg-icons";
interface CaptionEngineBarProps {
  onGenerate: () => void;
}

export function CaptionEngineBar({ onGenerate }: CaptionEngineBarProps) {
  return (
    <div className="shrink-0 space-y-3 border-t border-white/8 bg-[#1a1b1f] px-4 py-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex flex-1 items-center justify-between rounded-lg border border-white/10 bg-[#252830] px-3 py-2 text-left text-[13px] text-white/60 hover:border-white/20"
        >
          <span>Choose preset...</span>
          <FontAwesomeIcon
            icon={faChevronDown}
            className="text-[10px] opacity-50"
          />
        </button>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#252830] text-white/55 hover:bg-[#2a2d35]"
        >
          <FontAwesomeIcon icon={faBars} />
        </button>
      </div>

      <div>
        <div className="mb-1.5 text-[11px] text-white/40">Engine</div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex flex-1 items-center justify-between rounded-lg border border-white/10 bg-[#252830] px-3 py-2 text-left text-[13px] text-white/85 hover:border-white/20"
          >
            <span className="flex items-center gap-2">
              <FontAwesomeIcon icon={faScissors} className="text-white/50" />
              CapCut
              <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                Beta
              </span>
            </span>
            <FontAwesomeIcon
              icon={faChevronDown}
              className="text-[10px] opacity-50"
            />
          </button>
          <button
            type="button"
            onClick={onGenerate}
            className="rounded-lg bg-[#2b7cff] px-5 py-2 text-[13px] font-semibold text-white hover:bg-[#3a88ff]"
          >
            Generate
          </button>
        </div>
      </div>

      <div className="text-[11px] text-white/25">Language</div>
    </div>
  );
}
