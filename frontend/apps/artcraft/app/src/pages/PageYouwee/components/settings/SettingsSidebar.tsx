import {
  ArrowDownToLine,
  Atom,
  Globe,
  Info,
  MessageCircleCode,
  Package,
  Palette,
  Puzzle,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { SettingsSectionId } from './searchable-settings';

interface SettingsSidebarProps {
  activeSection: SettingsSectionId;
  onSectionChange: (section: SettingsSectionId) => void;
}

const SECTION_ICONS: Record<SettingsSectionId, React.ReactNode> = {
  general: <Palette className="w-4 h-4" />,
  dependencies: <Package className="w-4 h-4" />,
  download: <ArrowDownToLine className="w-4 h-4" />,
  'remote-download': <MessageCircleCode className="w-4 h-4" />,
  plugins: <Atom className="w-4 h-4" />,
  extension: <Puzzle className="w-4 h-4" />,
  ai: <Sparkles className="w-4 h-4" />,
  network: <Globe className="w-4 h-4" />,
  about: <Info className="w-4 h-4" />,
};

const SECTIONS: { id: SettingsSectionId; labelKey: string }[] = [
  { id: 'general', labelKey: 'sections.general' },
  { id: 'dependencies', labelKey: 'sections.dependencies' },
  { id: 'download', labelKey: 'sections.download' },
  { id: 'ai', labelKey: 'sections.ai' },
  { id: 'network', labelKey: 'sections.network' },
  { id: 'plugins', labelKey: 'sections.plugins' },
  { id: 'remote-download', labelKey: 'sections.remoteDownload' },
  { id: 'extension', labelKey: 'sections.extension' },
  { id: 'about', labelKey: 'sections.about' },
];

export function SettingsSidebar({ activeSection, onSectionChange }: SettingsSidebarProps) {
  const { t } = useTranslation('settings');

  return (
    <nav
      aria-label={t('title')}
      className="w-44 xl:w-48 2xl:w-52 flex-shrink-0 border-r border-border bg-panel/40 p-2 space-y-0.5"
    >
      {SECTIONS.map((section) => {
        const active = activeSection === section.id;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSectionChange(section.id)}
            className={cn(
              'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left text-sm transition-[color,background-color] duration-150',
              active
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
            )}
          >
            <span className={cn('shrink-0', active ? 'text-primary' : 'text-muted-foreground')}>
              {SECTION_ICONS[section.id]}
            </span>
            <span className="min-w-0 truncate leading-tight">{t(section.labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}
