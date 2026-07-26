export const getBase = () => {
  const envBase = import.meta.env?.VITE_FREELLM_API_BASE;
  if (typeof envBase === 'string' && envBase.startsWith('http')) {
    return envBase.replace(/\/$/, '');
  }
  return 'http://127.0.0.1:30000';
};

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const base = getBase();
  const res = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(body.error?.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}
