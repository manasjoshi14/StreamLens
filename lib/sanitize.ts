const IMDB_ID_PATTERN = /^tt\d{5,12}$/;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

export function sanitizeImdbId(value: string): string | null {
  const trimmed = value.trim();
  return IMDB_ID_PATTERN.test(trimmed) ? trimmed : null;
}

export function sanitizeHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}
