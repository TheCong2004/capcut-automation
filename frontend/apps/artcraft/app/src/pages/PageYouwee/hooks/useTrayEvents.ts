import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import type { Page } from '@/components/layout';
import type { SettingsSectionId } from '@/components/settings';

const isTauri =
  typeof window !== 'undefined' &&
  ('__TAURI__' in window || '__TAURI_INTERNALS__' in window);

export function useTrayEvents(
  setCurrentPage: (page: Page) => void,
  openSettingsPage: (section?: SettingsSectionId) => void,
  checkForUpdate: () => Promise<unknown>,
) {
  useEffect(() => {
    if (!isTauri) return;
    const unlisten = listen<string>('tray-open-channel', () => {
      setCurrentPage('channels');
    });

    return () => {
      unlisten.then((fn) => fn && fn()).catch(() => {});
    };
  }, [setCurrentPage]);

  useEffect(() => {
    if (!isTauri) return;
    const unlisten = listen('tray-check-update', () => {
      openSettingsPage('about');
      void checkForUpdate();
    });

    return () => {
      unlisten.then((fn) => fn && fn()).catch(() => {});
    };
  }, [checkForUpdate, openSettingsPage]);

  useEffect(() => {
    if (!isTauri) return;
    const unlisten = listen('tray-open-settings', () => {
      openSettingsPage('general');
    });

    return () => {
      unlisten.then((fn) => fn && fn()).catch(() => {});
    };
  }, [openSettingsPage]);

  useEffect(() => {
    const unlisten = listen('tray-open-extension', () => {
      openSettingsPage('extension');
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [openSettingsPage]);
}
