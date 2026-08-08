import React, { useEffect, useState } from "react";
import { Sidebar } from "@vynaro/components/layout/Sidebar";
import { TopBar } from "@vynaro/components/layout/TopBar";
import { CommandPalette } from "@vynaro/components/layout/CommandPalette";
import { useThemeStore } from "@vynaro/stores/theme-store";
import { HomePage } from "@vynaro/routes/index";
import { ProductionPage } from "@vynaro/routes/production";
import { AssetsPage } from "@vynaro/routes/assets";
import { SettingsPage } from "@vynaro/routes/settings";
import { HelpPage } from "@vynaro/components/help/HelpPage";

export type VynaroPath = "/" | "/production" | "/assets" | "/settings" | "/help";

export function EmbeddedAppShell() {
  const [currentPath, setCurrentPath] = useState<VynaroPath>("/");
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    const effective =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;
    root.dataset.theme = effective;
  }, [theme]);

  const renderContent = () => {
    switch (currentPath) {
      case "/":
        return <HomePage />;
      case "/production":
        return <ProductionPage />;
      case "/assets":
        return <AssetsPage />;
      case "/settings":
        return <SettingsPage />;
      case "/help":
        return <HelpPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden text-slate-100"
      style={{
        background: "var(--color-bg, #090a0f)",
        color: "var(--color-text-primary, #f1f5f9)",
      }}
    >
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentPath={currentPath} />
        <main className="flex-1 overflow-y-auto bg-[var(--color-bg,#090a0f)]">
          {renderContent()}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
