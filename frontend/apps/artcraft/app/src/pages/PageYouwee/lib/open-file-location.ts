import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './tauri';

export async function openFileLocation(filepath: string): Promise<void> {
  if (!isTauri) return;
  try {
    await invoke('open_file_location', { filepath });
  } catch {}
}
