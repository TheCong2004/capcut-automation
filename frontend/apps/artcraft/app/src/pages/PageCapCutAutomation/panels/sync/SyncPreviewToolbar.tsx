import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRotateLeft,
  faArrowRotateRight,
  faClosedCaptioning,
  faEyeSlash,
  faFont,
  faKey,
  faMagnifyingGlass,
  faPlay,
  faRotate,
} from "@fortawesome/pro-solid-svg-icons";

interface SyncPreviewToolbarProps {
  onRunSmall?: () => void;
}

export function SyncPreviewToolbar({ onRunSmall }: SyncPreviewToolbarProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#252830] px-2.5 py-1.5">
        <input
          type="search"
          placeholder="Find"
          className="w-28 bg-transparent text-[12px] text-white outline-none placeholder:text-white/35"
        />
        <FontAwesomeIcon
          icon={faMagnifyingGlass}
          className="text-[11px] text-white/35"
        />
      </div>

      <p className="text-[12px] text-white/35">Select a project to preview.</p>

      <div className="ml-auto flex items-center gap-1 text-white/40">
        <Tool icon={faRotate} title="Refresh" />
        <Tool icon={faArrowRotateLeft} title="Undo" />
        <Tool icon={faArrowRotateRight} title="Redo" />
        <Tool icon={faKey} title="Key" />
        <Tool icon={faFont} title="Font" />
        <Tool icon={faPlay} title="Play" />
        <Tool icon={faEyeSlash} title="Hide" />
        <Tool icon={faClosedCaptioning} title="Captions" />
      </div>

      {onRunSmall && (
        <button
          type="button"
          onClick={onRunSmall}
          className="rounded-full border border-white/15 bg-[#252830] px-4 py-1.5 text-[12px] font-medium text-white/70 hover:bg-[#2a2d35] hover:text-white"
        >
          Run
        </button>
      )}
    </div>
  );
}

function Tool({
  icon,
  title,
}: {
  icon: typeof faPlay;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/5 hover:text-white/80"
    >
      <FontAwesomeIcon icon={icon} className="text-[11px]" />
    </button>
  );
}
