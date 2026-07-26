import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { collectAssetScopeCandidates, normalizeAssetPath } from '@/lib/asset-paths';
import { isTauri } from './tauri';

const allowedAssetPaths = new Set<string>();

export async function ensureAssetPathAccess(path: string): Promise<string> {
  const normalized = normalizeAssetPath(path);
  if (!normalized) {
    throw new Error('Missing asset path');
  }

  if (isTauri && !allowedAssetPaths.has(normalized)) {
    try {
      await invoke('allow_asset_file', { path: normalized });
      allowedAssetPaths.add(normalized);
    } catch {}
  }

  return normalized;
}

export async function toAssetUrl(path: string): Promise<string> {
  const normalized = await ensureAssetPathAccess(path);
  if (!isTauri) return normalized;
  return convertFileSrc(normalized);
}

export async function syncAssetScopePaths(paths: string[]): Promise<void> {
  if (!isTauri) return;
  const candidates = collectAssetScopeCandidates(paths);
  if (candidates.length === 0) return;

  try {
    await invoke('sync_asset_scope_paths', { paths: candidates });
  } catch {}
}
