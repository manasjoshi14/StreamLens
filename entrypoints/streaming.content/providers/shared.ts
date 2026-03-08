export const TITLE_SUFFIX_PATTERNS = [
  /:\s*Season\s+\d+$/i,
  /:\s*Volume\s+\d+$/i,
  /:\s*Limited Series$/i,
  /:\s*Part\s+\d+$/i,
  /\s*\(Season\s+\d+\)$/i,
  /\s*\(Volume\s+\d+\)$/i,
  /\s*Season\s+\d+$/i,
];

const YEAR_PATTERN = /\((\d{4})\)/;

export function normalizeTitleText(raw: string): { title: string; year?: string } {
  let title = raw.trim();
  let year: string | undefined;

  const yearMatch = title.match(YEAR_PATTERN);
  if (yearMatch) {
    year = yearMatch[1];
    title = title.replace(YEAR_PATTERN, '').trim();
  }

  for (const pattern of TITLE_SUFFIX_PATTERNS) {
    title = title.replace(pattern, '').trim();
  }

  return { title, year };
}

export function getFirstAttr(element: Element, selectors: readonly string[], attr: string): string | null {
  for (const selector of selectors) {
    const match = element.querySelector(selector);
    const value = match?.getAttribute(attr)?.trim();
    if (value) return value;
  }
  return null;
}

export function getFirstText(element: Element, selectors: readonly string[]): string | null {
  for (const selector of selectors) {
    const match = element.querySelector(selector);
    const value = match?.textContent?.trim();
    if (value) return value;
  }
  return null;
}

export function getPositionedAncestor(root: Element, stopAt: Element): Element {
  let current: HTMLElement | null = root as HTMLElement;
  while (current && current !== stopAt) {
    const position = getComputedStyle(current).position;
    if (position === 'relative' || position === 'absolute') return current;
    current = current.parentElement;
  }
  return root;
}

export function hrefToSlugTitle(href: string): string | null {
  const cleaned = href.split('?')[0].split('#')[0];
  const parts = cleaned.split('/').filter(Boolean);
  let candidate: string | null = null;

  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (/[a-z]/i.test(part) && !/^\d+$/.test(part)) {
      candidate = part;
      break;
    }
  }

  if (!candidate) return null;
  return candidate
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
    .trim();
}

export function hrefToContentId(href: string): string | null {
  const cleaned = href.split('?')[0].split('#')[0];
  const numericMatch = cleaned.match(/(\d{6,})/);
  if (numericMatch) return numericMatch[1];

  const parts = cleaned.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
}
