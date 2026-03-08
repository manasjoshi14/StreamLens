import type { DetailInfo, StreamingProvider, TileInfo } from '../../../lib/types';
import { normalizeTitleText, getPositionedAncestor } from './shared';

const TILE_SELECTORS = [
  '[data-uia="title-card"]',
  '[data-uia="search-gallery-video-card"]',
  '.slider-item',
] as const;

const DETAIL_SELECTORS = [
  '.previewModal--container',
  '[data-uia="preview-modal-container"]',
  '[data-uia="mini-modal"]',
  '.mini-modal-container',
] as const;

const TITLE_TEXT_SELECTORS = [
  'a[aria-label]',
  'img[alt]',
  '.fallback-text',
] as const;

const UI_LABELS = new Set([
  'play', 'resume', 'next episode', 'watch now', 'watch',
  'add to my list', 'remove from my list', 'rate', 'share',
  'more info', 'info', 'close', 'mute', 'unmute', 'audio & subtitles',
  'thumbs up', 'thumbs down', 'not for me', 'love this',
  'new episode', 'new season', 'recently added',
]);

function queryTitleText(element: Element): string | null {
  const ownLabel = element.getAttribute('aria-label');
  if (ownLabel) return ownLabel;

  for (const selector of TITLE_TEXT_SELECTORS) {
    const el = element.querySelector(selector);
    if (!el) continue;

    if (selector === 'a[aria-label]') return el.getAttribute('aria-label');
    if (selector === 'img[alt]') return el.getAttribute('alt');
    return el.textContent?.trim() || null;
  }

  const labeled = element.querySelector('[aria-label]');
  if (labeled) return labeled.getAttribute('aria-label');

  const img = element.querySelector('img[alt]');
  if (img) return img.getAttribute('alt');

  return null;
}

function extractContentId(element: Element): string | null {
  const link = element.querySelector('a[href*="/title/"]');
  if (link) {
    const href = link.getAttribute('href') || '';
    const match = href.match(/\/title\/(\d+)/);
    if (match) return match[1];
  }
  return null;
}

function isUILabel(text: string): boolean {
  return UI_LABELS.has(text.toLowerCase().trim());
}

function extractDetailTitle(modal: Element): string | null {
  const logoSelectors = [
    'img[class*="titleTreatment"]',
    'img[class*="title-treatment"]',
    'img[alt][class*="logo"]',
  ];
  for (const sel of logoSelectors) {
    const img = modal.querySelector(sel);
    const alt = img?.getAttribute('alt');
    if (alt && !isUILabel(alt)) return alt;
  }

  const playerArea = modal.querySelector('[class*="player"], [class*="boxart"], [class*="artwork"]');
  const playerAlt = playerArea?.querySelector('img[alt]')?.getAttribute('alt');
  if (playerAlt && playerAlt.length > 1 && !isUILabel(playerAlt)) return playerAlt;

  const ownLabel = modal.getAttribute('aria-label');
  if (ownLabel && !isUILabel(ownLabel)) return ownLabel;

  const labeled = modal.querySelectorAll('[aria-label]');
  for (const el of labeled) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'button' || tag === 'a' || tag === 'input' || el.getAttribute('role') === 'button') continue;
    const label = el.getAttribute('aria-label');
    if (label && label.length > 1 && !isUILabel(label)) return label;
  }

  const imageAlt = modal.querySelector('img[alt]')?.getAttribute('alt');
  if (imageAlt && imageAlt.length > 1 && !isUILabel(imageAlt)) return imageAlt;

  const modalTitle = modal.querySelector('[data-uia="modal-title"]')?.textContent?.trim();
  if (modalTitle && modalTitle.length > 1 && !isUILabel(modalTitle)) return modalTitle;

  for (const tag of ['h2', 'h3']) {
    const text = modal.querySelector(tag)?.textContent?.trim();
    if (text && text.length > 1 && !isUILabel(text)) return text;
  }

  const strong = modal.querySelector('strong')?.textContent?.trim();
  if (strong && strong.length > 1 && !isUILabel(strong)) return strong;

  return null;
}

function extractDetailContentId(modal: Element): string | null {
  const links = modal.querySelectorAll('a[href*="/title/"], a[href*="/watch/"]');
  for (const link of links) {
    const href = link.getAttribute('href') || '';
    const match = href.match(/\/(?:title|watch)\/(\d+)/);
    if (match) return match[1];
  }

  const buttons = modal.querySelectorAll('button[data-uia]');
  for (const btn of buttons) {
    const uia = btn.getAttribute('data-uia') || '';
    const match = uia.match(/(\d{6,})/);
    if (match) return match[1];
  }

  return modal.querySelector('[data-video-id]')?.getAttribute('data-video-id') || null;
}

function findBadgeAnchor(modal: Element): Element | null {
  const selectors = [
    '[class*="player"]',
    '[class*="boxart"]',
    '[class*="artwork"]',
    '[class*="storyArt"]',
    'video',
    '.previewModal--player',
  ];

  for (const sel of selectors) {
    const el = modal.querySelector(sel);
    if (el) return getPositionedAncestor(el, modal);
  }

  return modal;
}

export const netflixProvider: StreamingProvider = {
  id: 'netflix',
  label: 'Netflix',
  matches: ['*://*.netflix.com/*'],
  tileSelectors: [...TILE_SELECTORS],
  detailSelectors: [...DETAIL_SELECTORS],
  isActivePage(location: Location): boolean {
    const path = location.pathname;
    return path === '/browse' || path.startsWith('/search');
  },
  extractTileInfo(element: Element): TileInfo | null {
    const rawText = queryTitleText(element);
    if (!rawText) return null;

    const { title, year } = normalizeTitleText(rawText);
    if (!title) return null;

    return {
      title,
      year,
      contentId: extractContentId(element) ?? undefined,
    };
  },
  extractDetailInfo(element: Element): DetailInfo | null {
    const title = extractDetailTitle(element);
    if (!title) return null;

    return {
      title,
      contentId: extractDetailContentId(element) ?? undefined,
      context: window.location.search.includes('jbv=') ? 'jbv' : 'hover',
    };
  },
  findDetailBadgeAnchor(element: Element): Element | null {
    return findBadgeAnchor(element);
  },
  getDetailCooldownMs(detail: DetailInfo): number {
    return detail.context === 'jbv' ? 30_000 : 1_200;
  },
};
