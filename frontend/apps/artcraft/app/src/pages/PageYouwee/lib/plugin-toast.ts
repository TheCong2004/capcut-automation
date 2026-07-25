function stripStructuredMetadata(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) {
    return '';
  }

  const withoutLevel = trimmed.replace(/^\[(debug|info|warn|error)\]\s*/i, '');
  const jsonStart = withoutLevel.lastIndexOf(' {');
  if (jsonStart <= 0) {
    return withoutLevel;
  }

  const message = withoutLevel.slice(0, jsonStart).trimEnd();
  const metadata = withoutLevel.slice(jsonStart + 1).trim();
  if (!metadata.startsWith('{') || !metadata.endsWith('}')) {
    return withoutLevel;
  }

  try {
    JSON.parse(metadata);
    return message;
  } catch {
    return withoutLevel;
  }
}

export function createPluginToastId(pluginId: string, runId?: string) {
  return `${pluginId}:${runId ?? 'unknown'}`;
}

export function formatPluginToastText(text: string): string {
  return text
    .split('\n')
    .map(stripStructuredMetadata)
    .filter((line) => line.length > 0)
    .join('\n');
}
