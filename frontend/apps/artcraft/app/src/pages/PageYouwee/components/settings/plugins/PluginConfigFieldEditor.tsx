import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { PluginConfigField, PluginSummary } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatConfigFieldDefaultValue, ToggleChoiceCard } from './post-download-plugins-shared';
import type { PostDownloadPluginsCardController } from './usePostDownloadPluginsCard';

type PluginConfigFieldEditorControllerProps = Pick<
  PostDownloadPluginsCardController,
  | 'getConfigDraftValue'
  | 'handleClearPluginConfig'
  | 'handlePickPluginConfigPath'
  | 'handleSavePluginConfig'
  | 'setConfigDraftValue'
>;

export function PluginConfigFieldEditor({
  controller,
  plugin,
  field,
}: {
  controller: PluginConfigFieldEditorControllerProps;
  plugin: PluginSummary;
  field: PluginConfigField;
}) {
  const { t } = useTranslation('settings');
  const isSet =
    plugin.installation.configValueStatus[field.key] ?? field.defaultValue !== undefined;
  const draftValue = controller.getConfigDraftValue(plugin, field);
  const defaultValueText = formatConfigFieldDefaultValue(field.defaultValue ?? undefined);
  const textLikeValue = typeof draftValue === 'string' ? draftValue : '';
  const selectedValues = Array.isArray(draftValue) ? draftValue : [];
  const booleanValue = Boolean(draftValue);
  const hasDraftContent = (() => {
    if (field.inputType === 'boolean') return true;
    if (field.inputType === 'multi-select') return selectedValues.length > 0;
    return textLikeValue.trim().length > 0;
  })();

  return (
    <div className="rounded-lg border border-border/60 px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium">{field.label}</p>
            {field.required && (
              <span className="rounded bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-600 dark:text-rose-400">
                {t('download.pluginConfigRequired')}
              </span>
            )}
            {field.sensitive && (
              <span className="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-600 dark:text-sky-400">
                {t('download.pluginConfigSensitive')}
              </span>
            )}
          </div>
          {field.description && (
            <p className="text-[11px] text-muted-foreground">{field.description}</p>
          )}
          {defaultValueText && (
            <p className="text-[11px] text-muted-foreground">
              {t('download.pluginConfigDefaultLabel')}: {defaultValueText}
            </p>
          )}
        </div>
        <span
          className={cn(
            'rounded px-2 py-0.5 text-[10px]',
            isSet
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
          )}
        >
          {isSet ? t('download.pluginConfigValueSet') : t('download.pluginConfigValueMissing')}
        </span>
      </div>

      <div className="mt-3 space-y-3">
        {(field.inputType === 'text' || field.inputType === 'password') && (
          <Input
            type={field.inputType === 'password' ? 'password' : 'text'}
            value={textLikeValue}
            onChange={(event) =>
              controller.setConfigDraftValue(plugin.manifest.id, field.key, event.target.value)
            }
            placeholder={
              field.sensitive && isSet
                ? t('download.pluginConfigReplacePlaceholder')
                : field.placeholder || t('download.pluginConfigValuePlaceholder')
            }
          />
        )}

        {field.inputType === 'textarea' && (
          <Textarea
            value={textLikeValue}
            onChange={(event) =>
              controller.setConfigDraftValue(plugin.manifest.id, field.key, event.target.value)
            }
            placeholder={field.placeholder || t('download.pluginConfigValuePlaceholder')}
            rows={4}
          />
        )}

        {field.inputType === 'number' && (
          <Input
            type="number"
            value={textLikeValue}
            onChange={(event) =>
              controller.setConfigDraftValue(plugin.manifest.id, field.key, event.target.value)
            }
            min={field.min ?? undefined}
            max={field.max ?? undefined}
            step={field.step ?? undefined}
            placeholder={field.placeholder || t('download.pluginConfigValuePlaceholder')}
          />
        )}

        {field.inputType === 'boolean' && (
          <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
            <span className="text-sm text-muted-foreground">
              {t('download.pluginConfigBooleanLabel')}
            </span>
            <Switch
              checked={booleanValue}
              onCheckedChange={(checked) =>
                controller.setConfigDraftValue(plugin.manifest.id, field.key, checked)
              }
            />
          </div>
        )}

        {(field.inputType === 'file' || field.inputType === 'directory') && (
          <div className="flex gap-2">
            <Input
              value={textLikeValue}
              onChange={(event) =>
                controller.setConfigDraftValue(plugin.manifest.id, field.key, event.target.value)
              }
              placeholder={field.placeholder || t('download.pluginConfigValuePlaceholder')}
            />
            <Button
              variant="outline"
              onClick={() =>
                controller.handlePickPluginConfigPath(
                  plugin,
                  field,
                  field.inputType === 'directory',
                )
              }
            >
              {t('download.pluginCreateBrowse')}
            </Button>
          </div>
        )}

        {field.inputType === 'select' && (
          <Select
            value={textLikeValue}
            onValueChange={(value) =>
              controller.setConfigDraftValue(plugin.manifest.id, field.key, value)
            }
          >
            <SelectTrigger>
              <SelectValue
                placeholder={field.placeholder || t('download.pluginConfigSelectPlaceholder')}
              />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {field.inputType === 'multi-select' && (
          <div className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="rounded bg-background/80 px-2 py-1">
                {selectedValues.length}/{field.options.length}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {field.options.map((option) => {
                const checked = selectedValues.includes(option.value);
                return (
                  <ToggleChoiceCard
                    key={option.value}
                    checked={checked}
                    label={option.label}
                    onToggle={() => {
                      const next = checked
                        ? selectedValues.filter((value) => value !== option.value)
                        : [...selectedValues, option.value];
                      controller.setConfigDraftValue(plugin.manifest.id, field.key, next);
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => controller.handleSavePluginConfig(plugin, field)}
            disabled={
              field.inputType === 'boolean' ? false : field.required ? !hasDraftContent : false
            }
          >
            {t('download.pluginConfigSave')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => controller.handleClearPluginConfig(plugin, field)}
            disabled={!isSet && field.defaultValue === undefined}
          >
            {t('download.pluginConfigClear')}
          </Button>
        </div>
      </div>
    </div>
  );
}
