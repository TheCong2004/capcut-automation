import {
  ChevronLeft,
  ChevronRight,
  FolderDown,
  Globe,
  Images,
  Moon,
  ScrollText,
  Settings,
  Sparkles,
  Subtitles,
  Sun,
  TableProperties,
  Tv,
  Wand2,
  Youtube,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

export type Page =
  | 'youtube'
  | 'universal'
  | 'gallery'
  | 'channels'
  | 'summary'
  | 'processing'
  | 'subtitles'
  | 'metadata'
  | 'library'
  | 'logs'
  | 'settings';

interface SidebarProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
}

interface NavItem {
  id: Page;
  labelKey: string;
  icon: React.ReactNode;
  group?: 'capture' | 'studio' | 'library' | 'system';
}

const navItems: NavItem[] = [
  {
    id: 'youtube',
    labelKey: 'sidebar.youtube',
    icon: <Youtube className="w-4 h-4" />,
    group: 'capture',
  },
  {
    id: 'universal',
    labelKey: 'sidebar.universal',
    icon: <Globe className="w-4 h-4" />,
    group: 'capture',
  },
  {
    id: 'gallery',
    labelKey: 'sidebar.gallery',
    icon: <Images className="w-4 h-4" />,
    group: 'capture',
  },
  {
    id: 'channels',
    labelKey: 'sidebar.channels',
    icon: <Tv className="w-4 h-4" />,
    group: 'capture',
  },
  {
    id: 'summary',
    labelKey: 'sidebar.summary',
    icon: <Sparkles className="w-4 h-4" />,
    group: 'studio',
  },
  {
    id: 'processing',
    labelKey: 'sidebar.processing',
    icon: <Wand2 className="w-4 h-4" />,
    group: 'studio',
  },
  {
    id: 'subtitles',
    labelKey: 'sidebar.subtitles',
    icon: <Subtitles className="w-4 h-4" />,
    group: 'studio',
  },
  {
    id: 'metadata',
    labelKey: 'sidebar.metadata',
    icon: <TableProperties className="w-4 h-4" />,
    group: 'library',
  },
  {
    id: 'library',
    labelKey: 'sidebar.library',
    icon: <FolderDown className="w-4 h-4" />,
    group: 'library',
  },
  {
    id: 'logs',
    labelKey: 'sidebar.logs',
    icon: <ScrollText className="w-4 h-4" />,
    group: 'library',
  },
  {
    id: 'settings',
    labelKey: 'sidebar.settings',
    icon: <Settings className="w-4 h-4" />,
    group: 'system',
  },
];

function NavButton({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation('common');

  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative w-full flex items-center gap-3 rounded-md px-2.5 py-2 text-left',
        'transition-colors duration-150',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
        collapsed && 'justify-center px-0',
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary"
        />
      )}
      <span className={cn('shrink-0', active && 'text-primary')}>{item.icon}</span>
      <span
        className={cn(
          'text-[13px] font-medium tracking-tight whitespace-nowrap transition-opacity duration-150',
          collapsed ? 'sr-only' : 'opacity-100',
        )}
      >
        {t(item.labelKey)}
      </span>
    </button>
  );

  if (!collapsed) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" className="font-medium">
        {t(item.labelKey)}
      </TooltipContent>
    </Tooltip>
  );
}

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const { t } = useTranslation('common');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { mode, toggleMode } = useTheme();

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'sidebar h-full flex flex-col shrink-0 border-r border-border bg-card',
          'relative overflow-hidden',
        )}
        style={{
          width: isCollapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)',
        }}
      >
        {/* Brand mark */}
        <div
          className={cn(
            'flex h-14 items-center border-b border-border shrink-0',
            isCollapsed ? 'justify-center px-2' : 'gap-2.5 px-3',
          )}
        >
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-panel overflow-hidden">
            <img src="/logo-128.png" alt="" className="h-full w-full object-cover" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-foreground">Youwee</span>
              <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Tools
              </span>
            </div>
          )}
        </div>

        {/* Navigation rail */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-0.5">
          {navItems.map((item, index) => {
            const prev = navItems[index - 1];
            const showDivider = prev && prev.group !== item.group;
            return (
              <div key={item.id}>
                {showDivider && <div className="my-2 mx-1 h-px bg-border" />}
                <NavButton
                  item={item}
                  active={currentPage === item.id}
                  collapsed={isCollapsed}
                  onClick={() => onPageChange(item.id)}
                />
              </div>
            );
          })}
        </nav>

        {/* Footer controls */}
        <div className="border-t border-border p-2 space-y-0.5 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleMode}
                className={cn(
                  'group w-full flex items-center gap-3 rounded-md px-2.5 py-2',
                  'text-muted-foreground hover:text-foreground hover:bg-muted/70',
                  'transition-colors duration-150',
                  isCollapsed && 'justify-center px-0',
                )}
              >
                <span className="shrink-0">
                  {mode === 'dark' ? (
                    <Sun className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Moon className="w-4 h-4 text-slate-500" />
                  )}
                </span>
                {!isCollapsed && (
                  <span className="text-[13px] font-medium tracking-tight">
                    {mode === 'dark' ? t('sidebar.light') : t('sidebar.dark')}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right" className="font-medium">
                {mode === 'dark' ? t('sidebar.lightMode') : t('sidebar.darkMode')}
              </TooltipContent>
            )}
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className={cn(
                  'group w-full flex items-center gap-3 rounded-md px-2.5 py-2',
                  'text-muted-foreground hover:text-foreground hover:bg-muted/70',
                  'transition-colors duration-150',
                  isCollapsed && 'justify-center px-0',
                )}
              >
                <span className="shrink-0">
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4" />
                  ) : (
                    <ChevronLeft className="w-4 h-4" />
                  )}
                </span>
                {!isCollapsed && (
                  <span className="text-[13px] font-medium tracking-tight">
                    {t('sidebar.collapse')}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right" className="font-medium">
                {t('sidebar.expand')}
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
