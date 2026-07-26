// Top-level shell for the artcraft app. Always-mounted chrome
// (TopBar, login + pricing modals, toaster, Tauri event listeners,
// background refresh hooks) lives here, and a single tab-driven
// switch picks the active page below it.

import React, { Component, useEffect, useState } from "react";
import * as gpu from "detect-gpu";
import { useSignals } from "@preact/signals-react/runtime";

import { TopBar } from "~/components";
import { ErrorDialog } from "~/components";
import { LoginModal, useLoginModalStore } from "@storyteller/ui-login-modal";
import { toast, Toaster } from "@storyteller/ui-toaster";
import {
  GalleryDragComponent,
  GalleryItem,
  onImageDrop,
  removeImageDropListener,
} from "@storyteller/ui-gallery-modal";
import {
  PricingModal,
  CreditsModal,
  useCreditsModalStore,
} from "@storyteller/ui-pricing-modal";
import {
  isActionReminderOpen,
  actionReminderProps,
  ActionReminderModal,
} from "@storyteller/ui-action-reminder-modal";
import {
  useGenerationEnqueueSuccessEvent,
} from "@storyteller/tauri-events";
import { useStoryboardPageEnabled } from "@storyteller/ui-settings-modal";
import { DomLevels, usePageSceneStore } from "@storyteller/ui-pagescene";

import { useActiveJobs } from "~/hooks/useActiveJobs";
import { useBackgroundLoadingMedia } from "~/hooks/useBackgroundLoadingMedia";
import { UsersApi } from "~/Classes/ApiManager";
import { authentication } from "~/signals";
import { AUTH_STATUS } from "~/enums";
import { useTabStore } from "./Stores/TabState";

import { AppsIndexPage } from "./PageApps/AppsIndexPage";
import PageDraw from "./PageDraw/PageDraw";
import TextToImage from "./PageImage/TextToImage";
import ImageToVideo from "./PageVideo/ImageToVideo";
import CreateAudio from "./PageAudio/CreateAudio";
import { VideoFrameExtractor } from "./PageVideoFrameExtractor";
import { VideoWatermarkRemover } from "./PageVideoWatermarkRemover";
import { ImageWatermarkRemover } from "./PageImageWatermarkRemover";
import { ImageTo3DObject } from "./PageImageTo3DObject";
import { ImageTo3DWorld } from "./PageImageTo3DWorld";
import { RemoveBackground } from "./PageRemoveBackground";
import { Angles } from "./PageAngles";
import { Storyboard } from "./PageStoryboard";
import { PageBackgroundChange } from "./PageBackgroundChange";
import { PageScene } from "./PageScene";
import { PageVideoEditor } from "./PageVideoEditor";
import { PageMoodboard } from "./PageMoodboard";
import { CapCutAutomation } from "./PageCapCutAutomation";
import { Youwee } from "./PageYouwee";
import { PageMediaCrawler } from "./PageMediaCrawler";
import { PageOpenMontage } from "./PageOpenMontage";
import { PageFreeLLMApi } from "./freellmapi";
import { PageOmniRoute } from "./OmniRoute";
import {
  topNavMediaId,
  topNavMediaUrl,
} from "~/components/signaled/TopBar/TopBar";

interface Props {
  sceneToken?: string;
}

class TabErrorBoundary extends Component<
  { children: React.ReactNode; tabName: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: any) {
    console.error(`[TabErrorBoundary] Error in ${this.props.tabName}:`, error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-[calc(100vh-56px)] w-full flex-col items-center justify-center bg-[#121318] p-8 text-center text-slate-200">
          <div className="rounded-2xl border border-red-500/20 bg-[#1c1e26] p-8 max-w-md space-y-4 shadow-xl">
            <h3 className="text-xl font-bold text-white">
              Ứng dụng {this.props.tabName} gặp sự cố
            </h3>
            <p className="text-xs text-red-400 font-mono bg-[#0e0f14] p-3 rounded-xl overflow-x-auto text-left">
              {this.state.error?.message || "Lỗi không xác định"}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition"
            >
              Thử lại
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const MainApp = ({ sceneToken }: Props) => {
  useSignals();

  useActiveJobs();
  useBackgroundLoadingMedia();
  useGenerationEnqueueSuccessEvent();

  useEffect(() => {
    const usersApi = new UsersApi();
    usersApi.GetSession().then((result) => {
      console.log(
        `User Info | Username: ${result.data?.user?.username}, Token: ${result.data?.user?.user_token}`,
      );
    });
  }, []);

  const [, setValidGpu] = useState("unknown");
  useEffect(() => {
    const { getGPUTier } = gpu;
    getGPUTier().then((gpuTier) => {
      console.log("GPU tier", gpuTier);
      let isValid = false;
      const fps = gpuTier.fps || 0;
      if (gpuTier.tier > 1) isValid = true;
      if (fps > 15) isValid = true;
      if (gpuTier.gpu === "apple gpu (Apple GPU)") isValid = true;
      setValidGpu(isValid ? "valid" : "error");
    });
  }, []);

  const { triggerRecheck } = useLoginModalStore();
  const { isOpen: isCreditsOpen, closeModal: closeCreditsModal } =
    useCreditsModalStore();
  const disableHotkeyInput = usePageSceneStore((s) => s.disableHotkeyInput);
  const enableHotkeyInput = usePageSceneStore((s) => s.enableHotkeyInput);

  const currentReminderModalProps = actionReminderProps.value;

  return (
    <div className="w-screen">
      <TopBar
        loginSignUpPressed={() => {
          console.log("PRESSED");
          triggerRecheck();
        }}
        pageName="Edit Scene"
      />
      <LoginModal
        videoSrc2D="/resources/videos/artcraft-canvas-demo.mp4"
        videoSrc3D="/resources/videos/artcraft-3d-demo.mp4"
        onOpenChange={(isOpen: boolean) => {
          if (isOpen) {
            disableHotkeyInput(DomLevels.DIALOGUE);
          } else {
            enableHotkeyInput(DomLevels.DIALOGUE);
          }
        }}
        onArtCraftAuthSuccess={(userInfo: any) => {
          authentication.status.value = AUTH_STATUS.LOGGED_IN;
          authentication.userInfo.value = userInfo;
        }}
      />

      <TabBody sceneToken={sceneToken} />

      <GalleryDragComponent />
      <ErrorDialog />
      <Toaster offsetTop={70} offsetRight={12} zIndex={9999} />
      {currentReminderModalProps && (
        <ActionReminderModal
          isOpen={isActionReminderOpen.value}
          onClose={currentReminderModalProps.onClose}
          reminderType={currentReminderModalProps.reminderType}
          onPrimaryAction={currentReminderModalProps.onPrimaryAction}
          title={currentReminderModalProps.title}
          message={currentReminderModalProps.message}
          primaryActionText={currentReminderModalProps.primaryActionText}
          secondaryActionText={currentReminderModalProps.secondaryActionText}
          onSecondaryAction={currentReminderModalProps.onSecondaryAction}
          isLoading={currentReminderModalProps.isLoading}
          openAiLogo={currentReminderModalProps.openAiLogo}
          primaryActionIcon={currentReminderModalProps.primaryActionIcon}
          primaryActionBtnClassName={
            currentReminderModalProps.primaryActionBtnClassName
          }
        />
      )}
      <PricingModal />
      <CreditsModal isOpen={isCreditsOpen} onClose={closeCreditsModal} />
    </div>
  );
};

const TabBody = ({ sceneToken }: { sceneToken?: string }) => {
  const tabStore = useTabStore();
  const storyboardPageEnabled = useStoryboardPageEnabled();

  const tabId = tabStore.activeTabId;

  return (
    <TabErrorBoundary tabName={tabId} key={tabId}>
      {(() => {
        switch (tabId) {
          case "3D":
            return <PageScene sceneToken={sceneToken} />;
          case "APPS":
            return (
              <div>
                <AppsIndexPage />
              </div>
            );
          case "2D":
            return (
              <div>
                <PageDrawWithGalleryDrop />
              </div>
            );
          case "IMAGE":
            return (
              <div>
                <TextToImage
                  imageMediaId={topNavMediaId.value}
                  imageUrl={topNavMediaUrl.value}
                />
              </div>
            );
          case "VIDEO":
            return (
              <div>
                <ImageToVideo />
              </div>
            );
          case "AUDIO":
            return (
              <div>
                <CreateAudio />
              </div>
            );
          case "VIDEO_FRAME_EXTRACTOR":
            return (
              <div>
                <VideoFrameExtractor />
              </div>
            );
          case "VIDEO_WATERMARK_REMOVAL":
            return (
              <div>
                <VideoWatermarkRemover />
              </div>
            );
          case "IMAGE_WATERMARK_REMOVAL":
            return (
              <div>
                <ImageWatermarkRemover />
              </div>
            );
          case "IMAGE_TO_3D_OBJECT":
            return (
              <div>
                <ImageTo3DObject />
              </div>
            );
          case "IMAGE_TO_3D_WORLD":
            return (
              <div>
                <ImageTo3DWorld />
              </div>
            );
          case "REMOVE_BACKGROUND":
            return (
              <div>
                <RemoveBackground />
              </div>
            );
          case "ANGLES":
            return (
              <div>
                <Angles />
              </div>
            );
          case "STORYBOARD":
            return storyboardPageEnabled ? (
              <div>
                <Storyboard />
              </div>
            ) : null;
          case "BACKGROUND_CHANGE":
            return (
              <div>
                <PageBackgroundChange />
              </div>
            );
          case "VIDEO_EDITOR":
            return (
              <div className="h-[calc(100vh-3rem)] w-full">
                <PageVideoEditor />
              </div>
            );
          case "MOODBOARD":
            return (
              <div className="h-[calc(100vh-56px)] w-full overflow-hidden">
                <PageMoodboard />
              </div>
            );
          case "CAPCUT_AUTOMATION":
            return (
              <div>
                <CapCutAutomation />
              </div>
            );
          case "YOUWEE":
            return (
              <div>
                <Youwee />
              </div>
            );
          case "MEDIA_CRAWLER":
            return (
              <div className="h-[calc(100vh-56px)] w-full overflow-hidden">
                <PageMediaCrawler />
              </div>
            );
          case "OPEN_MONTAGE":
            return (
              <div className="h-[calc(100vh-56px)] w-full overflow-hidden">
                <PageOpenMontage />
              </div>
            );
          case "FREE_LLM_API":
            return (
              <div className="h-[calc(100vh-56px)] w-full overflow-hidden">
                <PageFreeLLMApi />
              </div>
            );
          case "OMNI_ROUTE":
            return (
              <div className="h-[calc(100vh-56px)] w-full overflow-hidden">
                <PageOmniRoute />
              </div>
            );
          default:
            return null;
        }
      })()}
    </TabErrorBoundary>
  );
};

const PageDrawWithGalleryDrop = () => {
  useEffect(() => {
    const handler = onImageDrop(
      (item: GalleryItem, position: { x: number; y: number }) => {
        const canvasElement = document.querySelectorAll("canvas")[0];
        if (!canvasElement) return;
        const rect = canvasElement.getBoundingClientRect();
        if (
          position.x >= rect.left &&
          position.x <= rect.right &&
          position.y >= rect.top &&
          position.y <= rect.bottom
        ) {
          const dropEvent = new CustomEvent("gallery-2d-drop", {
            detail: { item, position: { x: position.x - rect.left, y: position.y - rect.top } },
          });
          window.dispatchEvent(dropEvent);
        }
      },
    );

    return () => {
      if (handler) {
        removeImageDropListener(handler);
      }
    };
  }, []);

  return <PageDraw />;
};
