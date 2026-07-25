import { Atom } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PostDownloadPluginsCard } from '@/components/settings/PostDownloadPluginsCard';
import { SettingsSection } from '../SettingsSection';

interface PluginsSectionProps {
  highlightId?: string | null;
}

export function PluginsSection({ highlightId }: PluginsSectionProps) {
  const { t } = useTranslation('settings');

  return (
    <div className="space-y-6">
      <div
        id="plugins-manager"
        className={highlightId === 'plugins-manager' ? 'rounded-md ring-1 ring-primary/40' : ''}
      >
        <SettingsSection
          title={t('plugins.title')}
          description={t('plugins.description')}
          icon={<Atom className="w-4 h-4" />}
        >
          <PostDownloadPluginsCard />
        </SettingsSection>
      </div>
    </div>
  );
}
