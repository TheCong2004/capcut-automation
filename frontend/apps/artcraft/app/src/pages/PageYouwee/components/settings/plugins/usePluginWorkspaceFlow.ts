import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { localizeUnknownError } from '@/lib/backend-error';
import type {
  PluginProvider,
  PluginSummary,
  PluginToolPermission,
  PluginWorkspaceSummary,
} from '@/lib/types';
import {
  type CreatePluginConfigFieldDraft,
  type CreatePluginConfigOptionDraft,
  type CreatePluginFormState,
  createEmptyConfigFieldDraft as createEmptyFieldDraft,
  DEFAULT_CREATE_PLUGIN_FORM,
  parseConfigFieldDraft,
  validateCreatePluginConfigFields,
  type WorkflowTrigger,
} from './post-download-plugins-shared';

export function usePluginWorkspaceFlow(
  t: TFunction<'settings'>,
  setError: Dispatch<SetStateAction<string | null>>,
  loadPlugins: () => Promise<void>,
) {
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [runtimeGuideOpen, setRuntimeGuideOpen] = useState(false);
  const [createPluginForm, setCreatePluginForm] = useState<CreatePluginFormState>(
    DEFAULT_CREATE_PLUGIN_FORM,
  );
  const [createdWorkspace, setCreatedWorkspace] = useState<PluginWorkspaceSummary | null>(null);
  const [createPluginConfigTouched, setCreatePluginConfigTouched] = useState<
    Record<string, boolean>
  >({});
  const [createPluginSubmitAttempted, setCreatePluginSubmitAttempted] = useState(false);
  const [attachWorkspacePath, setAttachWorkspacePath] = useState<string | null>(null);

  const createPluginConfigValidation = useMemo(
    () =>
      validateCreatePluginConfigFields(createPluginForm.configFields, t, {
        activeFieldIds: new Set(
          Object.entries(createPluginConfigTouched)
            .filter(([, touched]) => touched)
            .map(([clientId]) => clientId),
        ),
        showAll: createPluginSubmitAttempted,
      }),
    [createPluginConfigTouched, createPluginForm.configFields, createPluginSubmitAttempted, t],
  );

  const createPluginCanSubmit =
    !creating &&
    createPluginForm.name.trim().length > 0 &&
    createPluginForm.destinationRoot.trim().length > 0 &&
    !createPluginConfigValidation.hasErrors;

  const updateCreatePluginForm = useCallback(
    <K extends keyof CreatePluginFormState>(key: K, value: CreatePluginFormState[K]) => {
      setCreatePluginForm((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const resetCreateDialog = useCallback(() => {
    setCreatePluginForm(DEFAULT_CREATE_PLUGIN_FORM);
    setCreatePluginConfigTouched({});
    setCreatePluginSubmitAttempted(false);
    setCreateOpen(false);
  }, []);

  const openCreateDialog = useCallback(() => {
    setCreatePluginConfigTouched({});
    setCreatePluginSubmitAttempted(false);
    setCreateOpen(true);
  }, []);

  const dismissCreatedWorkspace = useCallback(() => {
    setCreatedWorkspace(null);
  }, []);

  const handlePickWorkspaceRoot = useCallback(async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t('download.pluginCreatePickLocation'),
    });
    if (typeof selected !== 'string') return;
    setCreatePluginForm((current) => ({ ...current, destinationRoot: selected }));
  }, [t]);

  const handleAttachWorkspace = useCallback(
    async (workspacePath?: string) => {
      const selected =
        workspacePath ??
        (await open({
          directory: true,
          multiple: false,
          title: t('download.pluginAttachWorkspace'),
        }));

      if (typeof selected !== 'string' || !selected) return;
      setAttachWorkspacePath(selected);
    },
    [t],
  );

  const handleConfirmAttachWorkspace = useCallback(async () => {
    if (!attachWorkspacePath) return;
    setError(null);
    try {
      await invoke<PluginSummary>('attach_plugin_workspace', {
        input: { value: attachWorkspacePath },
      });
      setAttachWorkspacePath(null);
      await loadPlugins();
    } catch (err) {
      console.error('Failed to attach plugin workspace:', err);
      setError(localizeUnknownError(err));
    }
  }, [attachWorkspacePath, loadPlugins, setError]);

  const handleCreatePlugin = useCallback(async () => {
    setCreatePluginSubmitAttempted(true);
    const trimmedName = createPluginForm.name.trim();
    const trimmedDestinationRoot = createPluginForm.destinationRoot.trim();
    const submitValidation = validateCreatePluginConfigFields(createPluginForm.configFields, t, {
      showAll: true,
    });
    if (!trimmedName || !trimmedDestinationRoot || submitValidation.hasErrors) return;

    const supportedProviders =
      createPluginForm.supportedProviders.length > 0
        ? createPluginForm.supportedProviders
        : DEFAULT_CREATE_PLUGIN_FORM.supportedProviders;
    const preferredProvider = supportedProviders[0];

    setCreating(true);
    setError(null);
    try {
      const result = await invoke<PluginWorkspaceSummary>('create_plugin_workspace', {
        input: {
          name: trimmedName,
          destinationRoot: trimmedDestinationRoot,
          icon: createPluginForm.icon || null,
          id: createPluginForm.id.trim() || null,
          slug: createPluginForm.slug.trim() || null,
          version: createPluginForm.version.trim() || null,
          description: createPluginForm.description.trim() || null,
          author: createPluginForm.author.trim() || null,
          homepage: createPluginForm.homepage.trim() || null,
          repository: createPluginForm.repository.trim() || null,
          license: createPluginForm.license.trim() || null,
          timeoutSec: Number.parseInt(createPluginForm.timeoutSec, 10) || 60,
          triggers:
            createPluginForm.triggers.length > 0
              ? createPluginForm.triggers
              : DEFAULT_CREATE_PLUGIN_FORM.triggers,
          supportedProviders,
          preferredProvider,
          configFields: createPluginForm.configFields.map(parseConfigFieldDraft),
          permissions: {
            network: createPluginForm.permissionNetwork,
            fs: createPluginForm.permissionFilesystem,
            tools: createPluginForm.permissionTools,
          },
        },
      });
      setCreatedWorkspace(result);
      setCreatePluginForm(DEFAULT_CREATE_PLUGIN_FORM);
      setCreatePluginConfigTouched({});
      setCreatePluginSubmitAttempted(false);
      setCreateOpen(false);
    } catch (err) {
      console.error('Failed to create plugin:', err);
      setError(localizeUnknownError(err));
    } finally {
      setCreating(false);
    }
  }, [createPluginForm, setError, t]);

  const toggleCreatePluginProvider = useCallback((provider: PluginProvider) => {
    setCreatePluginForm((current) => {
      const exists = current.supportedProviders.includes(provider);
      const supportedProviders = exists
        ? current.supportedProviders.filter((item) => item !== provider)
        : [...current.supportedProviders, provider];
      return {
        ...current,
        supportedProviders,
      };
    });
  }, []);

  const toggleCreatePluginTrigger = useCallback((trigger: WorkflowTrigger) => {
    setCreatePluginForm((current) => ({
      ...current,
      triggers: current.triggers.includes(trigger)
        ? current.triggers.filter((item) => item !== trigger)
        : [...current.triggers, trigger],
    }));
  }, []);

  const toggleCreatePluginFilesystemPermission = useCallback(
    (permission: PluginSummary['manifest']['permissions']['fs'][number]) => {
      setCreatePluginForm((current) => ({
        ...current,
        permissionFilesystem: current.permissionFilesystem.includes(permission)
          ? current.permissionFilesystem.filter((item) => item !== permission)
          : [...current.permissionFilesystem, permission],
      }));
    },
    [],
  );

  const toggleCreatePluginToolPermission = useCallback((permission: PluginToolPermission) => {
    setCreatePluginForm((current) => ({
      ...current,
      permissionTools: current.permissionTools.includes(permission)
        ? current.permissionTools.filter((item) => item !== permission)
        : [...current.permissionTools, permission],
    }));
  }, []);

  const markCreatePluginConfigFieldTouched = useCallback((clientId: string) => {
    setCreatePluginConfigTouched((current) => ({ ...current, [clientId]: true }));
  }, []);

  const addCreatePluginConfigField = useCallback(() => {
    setCreatePluginForm((current) => ({
      ...current,
      configFields: [...current.configFields, createEmptyFieldDraft()],
    }));
  }, []);

  const removeCreatePluginConfigField = useCallback(
    (index: number) => {
      const clientId = createPluginForm.configFields[index]?.clientId;
      setCreatePluginForm((current) => ({
        ...current,
        configFields: current.configFields.filter((_, fieldIndex) => fieldIndex !== index),
      }));
      if (clientId) {
        setCreatePluginConfigTouched((current) => {
          const next = { ...current };
          delete next[clientId];
          return next;
        });
      }
    },
    [createPluginForm.configFields],
  );

  const updateCreatePluginConfigField = useCallback(
    <K extends keyof CreatePluginConfigFieldDraft>(
      index: number,
      key: K,
      value: CreatePluginConfigFieldDraft[K],
    ) => {
      const clientId = createPluginForm.configFields[index]?.clientId;
      if (clientId) {
        markCreatePluginConfigFieldTouched(clientId);
      }
      setCreatePluginForm((current) => ({
        ...current,
        configFields: current.configFields.map((field, fieldIndex) => {
          if (fieldIndex !== index) return field;

          const nextField = { ...field, [key]: value };
          if (key === 'inputType') {
            const nextInputType = value as CreatePluginConfigFieldDraft['inputType'];
            if (nextInputType === 'select' || nextInputType === 'multi-select') {
              if (nextField.options.length === 0) {
                nextField.options = [createEmptyFieldDraft().options[0]];
              }
            } else {
              nextField.defaultValueMulti = [];
            }
          }
          return nextField;
        }),
      }));
    },
    [createPluginForm.configFields, markCreatePluginConfigFieldTouched],
  );

  const addCreatePluginConfigOption = useCallback(
    (fieldIndex: number) => {
      const clientId = createPluginForm.configFields[fieldIndex]?.clientId;
      if (clientId) {
        markCreatePluginConfigFieldTouched(clientId);
      }
      setCreatePluginForm((current) => ({
        ...current,
        configFields: current.configFields.map((field, index) =>
          index === fieldIndex
            ? {
                ...field,
                options: [
                  ...field.options,
                  {
                    clientId: `draft-${Math.random().toString(36).slice(2, 10)}`,
                    value: '',
                    label: '',
                  },
                ],
              }
            : field,
        ),
      }));
    },
    [createPluginForm.configFields, markCreatePluginConfigFieldTouched],
  );

  const removeCreatePluginConfigOption = useCallback(
    (fieldIndex: number, optionIndex: number) => {
      const clientId = createPluginForm.configFields[fieldIndex]?.clientId;
      if (clientId) {
        markCreatePluginConfigFieldTouched(clientId);
      }
      setCreatePluginForm((current) => ({
        ...current,
        configFields: current.configFields.map((field, index) => {
          if (index !== fieldIndex) return field;
          const nextOptions = field.options.filter(
            (_, currentOptionIndex) => currentOptionIndex !== optionIndex,
          );
          const validValues = new Set(
            nextOptions.map((option) => option.value.trim()).filter(Boolean),
          );
          return {
            ...field,
            options:
              nextOptions.length > 0
                ? nextOptions
                : [
                    {
                      clientId: `draft-${Math.random().toString(36).slice(2, 10)}`,
                      value: '',
                      label: '',
                    },
                  ],
            defaultValueMulti: field.defaultValueMulti.filter((value) => validValues.has(value)),
            defaultValueText:
              field.inputType === 'select' && validValues.has(field.defaultValueText)
                ? field.defaultValueText
                : field.inputType === 'select'
                  ? ''
                  : field.defaultValueText,
          };
        }),
      }));
    },
    [createPluginForm.configFields, markCreatePluginConfigFieldTouched],
  );

  const updateCreatePluginConfigOption = useCallback(
    <K extends keyof CreatePluginConfigOptionDraft>(
      fieldIndex: number,
      optionIndex: number,
      key: K,
      value: CreatePluginConfigOptionDraft[K],
    ) => {
      const clientId = createPluginForm.configFields[fieldIndex]?.clientId;
      if (clientId) {
        markCreatePluginConfigFieldTouched(clientId);
      }
      setCreatePluginForm((current) => ({
        ...current,
        configFields: current.configFields.map((field, index) =>
          index === fieldIndex
            ? {
                ...field,
                options: field.options.map((option, currentOptionIndex) =>
                  currentOptionIndex === optionIndex ? { ...option, [key]: value } : option,
                ),
              }
            : field,
        ),
      }));
    },
    [createPluginForm.configFields, markCreatePluginConfigFieldTouched],
  );

  const handleOpenWorkspacePath = useCallback(
    async (path: string) => {
      try {
        await invoke('open_file_location', { filepath: path });
      } catch (err) {
        console.error('Failed to open workspace path:', err);
        setError(t('download.pluginWorkspaceOpenError'));
      }
    },
    [setError, t],
  );

  return {
    addCreatePluginConfigField,
    addCreatePluginConfigOption,
    attachWorkspacePath,
    createOpen,
    creating,
    createPluginCanSubmit,
    createPluginConfigTouched,
    createPluginConfigValidation,
    createPluginForm,
    createPluginSubmitAttempted,
    createdWorkspace,
    dismissCreatedWorkspace,
    handleAttachWorkspace,
    handleConfirmAttachWorkspace,
    handleCreatePlugin,
    handleOpenWorkspacePath,
    handlePickWorkspaceRoot,
    openCreateDialog,
    removeCreatePluginConfigField,
    removeCreatePluginConfigOption,
    resetCreateDialog,
    runtimeGuideOpen,
    setAttachWorkspacePath,
    setCreateOpen,
    setCreatePluginConfigTouched,
    setCreatePluginForm,
    setCreatePluginSubmitAttempted,
    setRuntimeGuideOpen,
    toggleCreatePluginFilesystemPermission,
    toggleCreatePluginToolPermission,
    toggleCreatePluginProvider,
    toggleCreatePluginTrigger,
    updateCreatePluginConfigField,
    updateCreatePluginConfigOption,
    updateCreatePluginForm,
  };
}
