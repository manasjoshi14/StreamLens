import type { DetailInfo, StreamingProvider, TileInfo } from '../../../lib/types';
import { normalizeTitleText, getFirstAttr, getFirstText, getPositionedAncestor } from './shared';

const TILE_SELECTORS = [
  '[data-testid="standard-card"]',
  '[data-testid*="card"] a[href*="/detail/"]',
  '[data-testid*="content"] a[href*="/detail/"]',
  '[data-card-title]',
  'a[href*="/detail/"]',
] as const;

const DETAIL_SELECTORS = [
  'section[data-testid="standard-hero"]',
  '[data-testid*="hero"]',
  '[data-testid*="detail"]',
  '[data-testid*="header"]',
] as const;

const UI_LABELS = new Set([
  'play', 'resume', 'watch now', 'watch with ads', 'details', 'trailer',
  'add to watchlist', 'remove from watchlist', 'more details', 'episodes',
  'season 1', 'season 2', 'included with prime', 'rent', 'buy',
]);

function extractLink(element: Element): Element | null {
  if (typeof element.matches === 'function' && element.matches('a[href*="/detail/"]')) {
    return element;
  }
  return element.querySelector('a[href*="/detail/"]');
}

function extractContentId(element: Element): string | null {
  const direct = element.getAttribute('data-ref') || element.getAttribute('data-title-id');
  if (direct) return direct;

  const link = extractLink(element);
  if (!link) return null;
  const href = link.getAttribute('href') || '';
  const match = href.match(/\/detail\/([^/?#]+)/i);
  return match ? match[1] : null;
}

function isUILabel(value: string): boolean {
  return UI_LABELS.has(value.toLowerCase().trim());
}

function extractTitle(element: Element): string | null {
  const own = [
    element.getAttribute('data-card-title'),
    element.getAttribute('aria-label'),
    element.getAttribute('title'),
  ].find((value): value is string => Boolean(value));
  if (own && !isUILabel(own)) return own;

  const attrTitle =
    getFirstAttr(element, ['[data-card-title]'], 'data-card-title') ||
    getFirstAttr(element, ['[aria-label]'], 'aria-label') ||
    getFirstAttr(element, ['img[alt]'], 'alt') ||
    getFirstAttr(element, ['[title]'], 'title');
  if (attrTitle && !isUILabel(attrTitle)) return attrTitle;

  const textTitle = getFirstText(element, [
    '[data-testid*="title"]',
    'h1',
    'h2',
    'h3',
    '[class*="title"]',
  ]);
  if (textTitle && !isUILabel(textTitle)) return textTitle;

  return null;
}

function findBadgeAnchor(element: Element): Element | null {
  const selectors = [
    '[data-testid*="hero"] img',
    '[class*="hero"] img',
    '[class*="packshot"] img',
    '[class*="poster"] img',
    'img',
  ];
  for (const selector of selectors) {
    const found = element.querySelector(selector);
    if (found) return getPositionedAncestor(found, element);
  }
  return element;
}

export const primeProvider: StreamingProvider = {
  id: 'prime',
  label: 'Prime Video',
  matches: ['*://*.primevideo.com/*'],
  tileSelectors: [...TILE_SELECTORS],
  detailSelectors: [...DETAIL_SELECTORS],
  isActivePage(location: Location): boolean {
    const path = location.pathname.toLowerCase();
    return !path.includes('/watch') && !path.includes('/player');
  },
  extractTileInfo(element: Element): TileInfo | null {
    const rawTitle = extractTitle(element);
    if (!rawTitle) return null;

    const { title, year } = normalizeTitleText(rawTitle);
    if (!title) return null;

    return {
      title,
      year,
      contentId: extractContentId(element) ?? undefined,
    };
  },
  extractDetailInfo(element: Element): DetailInfo | null {
    const rawTitle = extractTitle(element);
    if (!rawTitle) return null;

    const { title } = normalizeTitleText(rawTitle);
    if (!title) return null;

    return {
      title,
      contentId: extractContentId(element) ?? undefined,
      context: 'detail',
    };
  },
  findDetailBadgeAnchor(element: Element): Element | null {
    return findBadgeAnchor(element);
  },
  getDetailCooldownMs(): number {
    return 1_500;
  },
};
