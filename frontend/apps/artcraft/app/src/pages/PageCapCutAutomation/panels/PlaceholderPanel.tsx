import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { SIDE_NAV } from "../constants";
import type { SideNavId } from "../types";

interface PlaceholderPanelProps {
  sideNavId: SideNavId;
}

export function PlaceholderPanel({ sideNavId }: PlaceholderPanelProps) {
  const item = SIDE_NAV.find((s) => s.id === sideNavId);

  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-white/40">
        {item && (
          <FontAwesomeIcon icon={item.icon} className="text-xl" />
        )}
      </div>
      <h2 className="text-lg font-semibold capitalize">{sideNavId}</h2>
      <p className="mt-1 max-w-sm text-sm text-white/45">
        UI shell ready — connect CapCut automation for this section next.
      </p>
    </div>
  );
}
