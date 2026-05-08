export const DEFAULT_API_BASE =
  process.env.NEXT_PUBLIC_BULLET_COMPARE_API_BASE ||
  "https://bulletanalyzrresearch-production.up.railway.app";

export function normalizeApiBase(apiBase: string): string {
  return apiBase.trim().replace(/\/+$/, "");
}

export function resolveApiUrl(
  apiBase: string,
  path: string,
  fallbackOrigin?: string,
): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = normalizeApiBase(apiBase) || fallbackOrigin || DEFAULT_API_BASE;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
