import type { DetailInfo, StreamingProvider, TileInfo } from '../../../lib/types';
import {
  normalizeTitleText,
  getFirstAttr,
  getFirstText,
  getPositionedAncestor,
  hrefToContentId,
  hrefToSlugTitle,
} from './shared';

const TILE_SELECTORS = [
  '[data-testid="tray-card-default"] [data-testid="action"][aria-label]',
  'main [data-testid="action"][aria-label]',
  'a[href*="/movies/"]',
  'a[href*="/movie/"]',
  'a[href*="/tv/"]',
  'a[href*="/show/"]',
  'a[href*="/shows/"]',
] as const;

const DETAIL_SELECTORS = [
  '[data-testid*="detail"]',
  '[data-testid*="hero"]',
  '[class*="detail"]',
  '[class*="hero"]',
] as const;

const UI_LABELS = new Set([
  'play', 'resume', 'watch now', 'subscribe', 'trailer', 'episodes', 'share',
  'more', 'watchlist', 'continue watching', 'sports', 'live', 'premium',
]);

const SUPPORTED_MEDIA_KINDS = new Set([
  'movie',
  'show',
  'series',
  'film',
  'special',
]);

const REJECTED_MEDIA_KINDS = new Set([
  'channel',
  'sport',
  'sports',
  'category',
  'genre',
  'network',
  'person',
  'creator',
  'collection',
]);

function parseAriaLabel(value: string | null): { title: string | null; kind: string | null } {
  const input = value?.trim();
  if (!input) return { title: null, kind: null };

  const separatorIndex = input.lastIndexOf(',');
  if (separatorIndex === -1) {
    return { title: input, kind: null };
  }

  const title = input.slice(0, separatorIndex).trim();
  const kind = input.slice(separatorIndex + 1).trim().toLowerCase();
  return {
    title: title || null,
    kind: kind || null,
  };
}

function isSupportedMediaKind(kind: string | null): boolean {
  if (!kind) return true;
  if (REJECTED_MEDIA_KINDS.has(kind)) return false;
  return SUPPORTED_MEDIA_KINDS.has(kind);
}

function extractLink(element: Element): HTMLAnchorElement | null {
  if (typeof element.matches === 'function' && element.matches('a[href]')) {
    return element as HTMLAnchorElement;
  }
  return element.querySelector('a[href]');
}

function isIgnoredHref(href: string): boolean {
  return /\/(watch|sports|search|subscribe|menu|account|settings|help|support|privacy|terms)(?:\/|$)/i.test(href);
}

function isUILabel(value: string): boolean {
  return UI_LABELS.has(value.toLowerCase().trim());
}

function hasPosterLikeMedia(element: Element): boolean {
  const img = element.querySelector('img');
  if (!img) return false;

  const rect = img.getBoundingClientRect();
  if (rect.width > 0 || rect.height > 0) {
    return rect.width >= 80 && rect.height >= 45;
  }

  const alt = img.getAttribute('alt') || '';
  return alt.trim().length > 0;
}

function isInsideNavigation(element: Element): boolean {
  return Boolean(element.closest('nav, aside, [role="navigation"], header'));
}

function looksLikePosterTile(element: Element): boolean {
  if (isInsideNavigation(element)) return false;
  if (element.closest('[data-testid="modalOverlay"] li[data-testid="episode-card"]')) return false;
  if (!hasPosterLikeMedia(element)) return false;

  const ownLabel = element.getAttribute('aria-label');
  const parsedOwnLabel = parseAriaLabel(ownLabel);
  if (ownLabel && !isSupportedMediaKind(parsedOwnLabel.kind)) return false;

  const link = extractLink(element);
  const href = link?.getAttribute('href') || '';
  if (href && isIgnoredHref(href)) return false;

  const rect = element.getBoundingClientRect();
  if ((rect.width > 0 || rect.height > 0) && rect.width < 80 && rect.height < 80) return false;

  const label =
    parsedOwnLabel.title ||
    element.getAttribute('title') ||
    element.querySelector('img[alt]')?.getAttribute('alt') ||
    '';

  if (label && isUILabel(label)) return false;

  return true;
}

function extractTitle(element: Element): string | null {
  const parsedOwnLabel = parseAriaLabel(element.getAttribute('aria-label'));
  if (parsedOwnLabel.title && !isUILabel(parsedOwnLabel.title) && isSupportedMediaKind(parsedOwnLabel.kind)) {
    return parsedOwnLabel.title;
  }

  const own = [
    element.getAttribute('data-title'),
    element.getAttribute('title'),
  ].find((value): value is string => Boolean(value));
  if (own && !isUILabel(own)) return own;

  const attrTitle =
    getFirstAttr(element, ['[data-title]'], 'data-title') ||
    getFirstAttr(element, ['img[alt]'], 'alt') ||
    getFirstAttr(element, ['[title]'], 'title');
  if (attrTitle && !isUILabel(attrTitle)) return attrTitle;

  const nestedAriaLabel = parseAriaLabel(getFirstAttr(element, ['[aria-label]'], 'aria-label'));
  if (nestedAriaLabel.title && !isUILabel(nestedAriaLabel.title) && isSupportedMediaKind(nestedAriaLabel.kind)) {
    return nestedAriaLabel.title;
  }

  const textTitle = getFirstText(element, [
    '[data-testid*="title"]',
    '[class*="title"]',
    'h1',
    'h2',
    'h3',
    'span',
  ]);
  if (textTitle && textTitle.length > 1 && !isUILabel(textTitle)) return textTitle;

  const href = extractLink(element)?.getAttribute('href') || '';
  if (href) {
    const fallback = hrefToSlugTitle(href);
    if (fallback && !isUILabel(fallback)) return fallback;
  }

  return null;
}

function extractContentId(element: Element): string | null {
  const direct =
    element.getAttribute('data-id') ||
    element.getAttribute('data-content-id') ||
    element.getAttribute('data-entity-id');
  if (direct) return direct;

  const href = extractLink(element)?.getAttribute('href') || '';
  if (!href || isIgnoredHref(href)) return null;
  return hrefToContentId(href);
}

function findBadgeAnchor(element: Element): Element | null {
  const article = element.querySelector('article');
  if (article) return getPositionedAncestor(article, element);

  const card = element.closest('[data-testid="tray-card-default"]');
  if (card) return getPositionedAncestor(card, element);

  const link = extractLink(element);
  if (link && hasPosterLikeMedia(link)) return getPositionedAncestor(link, element);

  const selectors = [
    '[data-testid="hs-image"]',
    '[class*="backdrop"] img',
    '[class*="poster"] img',
    '[class*="image"] img',
    '[class*="content"] img',
    'img',
  ];

  for (const selector of selectors) {
    const found = element.querySelector(selector);
    if (found) return getPositionedAncestor(found, element);
  }

  return element;
}

export const jioHotstarProvider: StreamingProvider = {
  id: 'jiohotstar',
  label: 'JioHotstar',
  matches: ['*://*.hotstar.com/*'],
  tileSelectors: [...TILE_SELECTORS],
  detailSelectors: [...DETAIL_SELECTORS],
  isActivePage(location: Location): boolean {
    const path = location.pathname.toLowerCase();
    return !path.includes('/watch') && !path.includes('/sports');
  },
  findTileElements(root: Element | Document): Element[] {
    const seen = new Set<Element>();
    const actionTiles = root.querySelectorAll('[data-testid="tray-card-default"] [data-testid="action"][aria-label], main [data-testid="action"][aria-label]');

    actionTiles.forEach(tile => {
      if (!looksLikePosterTile(tile)) return;
      seen.add(tile);
    });

    const links = root.querySelectorAll('a[href]');
    links.forEach(link => {
      if (!looksLikePosterTile(link)) return;
      seen.add(link);
    });

    return Array.from(seen);
  },
  extractTileInfo(element: Element): TileInfo | null {
    const link = extractLink(element);
    const href = link?.getAttribute('href') || '';
    if (href && isIgnoredHref(href)) return null;

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
