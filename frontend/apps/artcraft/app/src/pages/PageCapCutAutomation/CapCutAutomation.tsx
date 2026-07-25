import { useState } from "react";
import { CapCutMateProvider } from "./api/CapCutMateContext";
import { AllProjectPanel } from "./layout/AllProjectPanel";
import { CapCutSideNav } from "./layout/CapCutSideNav";
import { ProjectBar } from "./layout/ProjectBar";
import { AdjustmentPanel } from "./panels/adjustment/AdjustmentPanel";
import { AiGeneratePanel } from "./panels/ai-generate/AiGeneratePanel";
import { AnimationsPanel } from "./panels/animations/AnimationsPanel";
import { AutoRenderPanel } from "./panels/auto-render/AutoRenderPanel";
import { CaptionPanel } from "./panels/caption/CaptionPanel";
import { EffectsPanel } from "./panels/effects/EffectsPanel";
import { ExtensionPanel } from "./panels/extension/ExtensionPanel";
import { FiltersPanel } from "./panels/filters/FiltersPanel";
import { KeyframePanel } from "./panels/keyframe/KeyframePanel";
import { MaterialsPanel } from "./panels/materials/MaterialsPanel";
import { LocalDraftPanel } from "./panels/local/LocalDraftPanel";
import { MediaPanel } from "./panels/media/MediaPanel";
import { SoundsPanel } from "./panels/sounds/SoundsPanel";
import { StickersPanel } from "./panels/stickers/StickersPanel";
import { SyncPanel } from "./panels/sync/SyncPanel";
import { TransitionsPanel } from "./panels/transitions/TransitionsPanel";
import { WorkflowPanel } from "./panels/workflow/WorkflowPanel";
import { HelpFab } from "./shared/HelpFab";
import { ResizableSplit } from "./shared/ResizableSplit";
import type { SideNavId } from "./types";

export const CapCutAutomation = () => {
  const [sideNav, setSideNav] = useState<SideNavId>("materials");

  const mainPanel = (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      {sideNav === "materials" && <MaterialsPanel />}
      {sideNav === "local-draft" && <LocalDraftPanel />}
      {sideNav === "sync" && <SyncPanel />}
      {sideNav === "caption" && <CaptionPanel />}
      {sideNav === "effects" && <EffectsPanel />}
      {sideNav === "transitions" && <TransitionsPanel />}
      {sideNav === "filters" && <FiltersPanel />}
      {sideNav === "stickers" && <StickersPanel />}
      {sideNav === "animations" && <AnimationsPanel />}
      {sideNav === "sounds" && <SoundsPanel />}
      {sideNav === "adjustment" && <AdjustmentPanel />}
      {sideNav === "media" && <MediaPanel />}
      {sideNav === "keyframe" && <KeyframePanel />}
      {sideNav === "workflow" && <WorkflowPanel />}
      {sideNav === "auto-render" && <AutoRenderPanel />}
      {sideNav === "ai-generate" && <AiGeneratePanel />}
      {sideNav === "extension" && <ExtensionPanel />}
    </div>
  );

  return (
    <CapCutMateProvider>
      <div className="fixed inset-0 flex flex-col bg-[#1a1b1f] pt-[56px] text-white">
        <ProjectBar />

        {/* Menu trái (kéo) | Nội dung + Tất cả dự án (kéo mép phải panel) */}
        <div className="flex min-h-0 flex-1">
          <ResizableSplit
            resizeSide="left"
            storageKey="capcut-split-sidenav"
            defaultWidth={200}
            minWidth={160}
            maxWidth={300}
            left={
              <CapCutSideNav activeId={sideNav} onSelect={setSideNav} />
            }
            right={
              <div className="flex h-full min-h-0 min-w-0 flex-1">
                {mainPanel}
                <AllProjectPanel />
              </div>
            }
          />
        </div>

        <HelpFab />
      </div>
    </CapCutMateProvider>
  );
};
