import React from 'react';
import {
  Activity,
  Boxes,
  ChevronLeft,
  ChevronRight,
  FileArchive,
  Gauge,
  ListChecks,
  Logs,
  Menu,
  Network,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Workflow,
  X,
} from 'lucide-react';

export type FlowordView =
  | 'overview'
  | 'studio'
  | 'workflow'
  | 'services'
  | 'jobs'
  | 'artifacts'
  | 'logs'
  | 'settings_providers'
  | 'settings_models'
  | 'settings_voice'
  | 'settings_automation';

interface FlowordSidebarProps {
  activeView: FlowordView;
  collapsed: boolean;
  mobileOpen: boolean;
  onChange: (view: FlowordView) => void;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  onOpenMobile: () => void;
}

const primaryItems = [
  { id: 'overview', label: 'Overview', icon: Gauge },
  { id: 'studio', label: 'Studio', icon: Sparkles },
  { id: 'workflow', label: 'Workflow', icon: Workflow },
  { id: 'services', label: 'Services', icon: Network },
  { id: 'jobs', label: 'Jobs', icon: ListChecks },
  { id: 'artifacts', label: 'Artifacts', icon: FileArchive },
  { id: 'logs', label: 'Logs', icon: Logs },
] as const;

const settingsItems = [
  { id: 'settings_providers', label: 'Providers', icon: Boxes },
  { id: 'settings_models', label: 'Models', icon: SlidersHorizontal },
  { id: 'settings_voice', label: 'Voice', icon: Activity },
  { id: 'settings_automation', label: 'Automation', icon: Settings },
] as const;

export const FlowordSidebar: React.FC<FlowordSidebarProps> = ({
  activeView,
  collapsed,
  mobileOpen,
  onChange,
  onToggleCollapse,
  onCloseMobile,
  onOpenMobile,
}) => {
  const renderItem = (item: (typeof primaryItems)[number] | (typeof settingsItems)[number], nested = false) => {
    const Icon = item.icon;
    const active = activeView === item.id;
    return (
      <button
        key={item.id}
        type="button"
        title={collapsed ? item.label : undefined}
        aria-current={active ? 'page' : undefined}
        onClick={() => {
          onChange(item.id);
          onCloseMobile();
        }}
        className={`flex w-full items-center gap-3 rounded-[9px] px-3 py-2 text-sm font-medium ${
          nested && !collapsed ? 'pl-9' : ''
        } ${
          active
            ? 'bg-white/[0.08] text-white'
            : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100'
        }`}
      >
        <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[#e54d5e]' : 'text-zinc-500'}`} />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </button>
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={onOpenMobile}
        className="fixed left-3 top-3 z-40 rounded-[9px] border border-white/10 bg-[#161b22] p-2 text-zinc-200 md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={onCloseMobile}
          aria-label="Close navigation overlay"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col border-r border-white/[0.08] bg-[#10141e] md:static ${
          collapsed ? 'w-[72px]' : 'w-[232px]'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/[0.08] px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#e54d5e] to-[#a855f7] text-white">
            <Workflow className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">Floword Studio</div>
              <div className="text-[11px] text-zinc-500">Production workspace</div>
            </div>
          )}
          <button
            type="button"
            onClick={onCloseMobile}
            className="ml-auto p-1 text-zinc-400 md:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Floword Studio">
          {primaryItems.map((item) => renderItem(item))}

          <div className="my-4 border-t border-white/[0.08]" />
          {!collapsed && (
            <div className="mb-2 flex items-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
              <Settings className="h-3.5 w-3.5" /> Settings
            </div>
          )}
          {settingsItems.map((item) => renderItem(item, true))}
        </nav>

        <div className="border-t border-white/[0.08] p-3">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden w-full items-center justify-center rounded-[9px] p-2 text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200 md:flex"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>
    </>
  );
};
