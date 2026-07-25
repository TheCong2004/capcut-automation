import { FileCode2, TableProperties } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ThemePicker } from '@/components/settings/ThemePicker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AssetsExportTab } from '@/pages/metadata/AssetsExportTab';
import { DataExportTab } from '@/pages/metadata/DataExportTab';

export function MetadataPage() {
  const { t } = useTranslation('metadata');

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex h-12 flex-shrink-0 items-center justify-between gap-3 border-b border-border px-4 sm:h-14 sm:px-5">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold tracking-tight sm:text-base">
            {t('title')}
          </h1>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">{t('subtitle')}</p>
        </div>
        <ThemePicker />
      </header>

      <Tabs defaultValue="data" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-shrink-0 border-b border-border bg-panel/50 px-4 py-2.5 sm:px-5">
          <TabsList className="grid h-9 w-full max-w-xs grid-cols-2">
            <TabsTrigger value="data" className="gap-1.5 text-xs">
              <TableProperties className="h-3.5 w-3.5" />
              {t('tabs.data')}
            </TabsTrigger>
            <TabsTrigger value="assets" className="gap-1.5 text-xs">
              <FileCode2 className="h-3.5 w-3.5" />
              {t('tabs.assets')}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="data"
          className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=active]:flex"
        >
          <DataExportTab />
        </TabsContent>
        <TabsContent
          value="assets"
          className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=active]:flex"
        >
          <AssetsExportTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
