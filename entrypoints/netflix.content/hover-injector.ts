import type { RatingsData } from '../../lib/types';
import type { Message, MessageResponse } from '../../lib/messages';
import { escapeHtml } from '../../lib/sanitize';
import { imdbIcon, rtIcon, mcIcon, scoreToColor } from './icons';

const HOVER_BADGE_TAG = 'nfr-hover-badge';
const HOVER_COOLDOWN_MS = 1200;
const JBV_COOLDOWN_MS = 30_000;

/** Context-aware dedupe map: `context:identifier` → timestamp */
export const processedMap = new Map<string, number>();

export function getDedupeContext(): 'jbv' | 'hover' {
  return window.location.search.includes('jbv=') ? 'jbv' : 'hover';
}

export function getCooldownMs(): number {
  return getDedupeContext() === 'jbv' ? JBV_COOLDOWN_MS : HOVER_COOLDOWN_MS;
}

export function makeDedupeKey(netflixId: string | null, title: string | null): string | null {
  const context = getDedupeContext();
  // Prefer title for dedup — Netflix uses multiple IDs for the same show
  if (title) return `${context}:${title.toLowerCase().trim()}`;
  if (netflixId) return `${context}:${netflixId}`;
  return null;
}

export function isDuplicate(key: string): boolean {
  const lastSeen = processedMap.get(key);
  if (lastSeen == null) return false;
  return (Date.now() - lastSeen) < getCooldownMs();
}

function pruneProcessedMap(): void {
  if (processedMap.size <= 50) return;
  const now = Date.now();
  for (const [key, ts] of processedMap) {
    if (now - ts > JBV_COOLDOWN_MS) processedMap.delete(key);
  }
}

const HOVER_SELECTORS = [
  '.previewModal--container',
  '[data-uia="preview-modal-container"]',
  '[data-uia="mini-modal"]',
  '.mini-modal-container',
];

function createBadgeHTML(data: RatingsData): string {
  const parts: string[] = [];

  const imdb = parseFloat(data.imdbRating);
  if (!isNaN(imdb)) {
    const color = scoreToColor(imdb * 10);
    parts.push(`<span class="hb-score">${imdbIcon(14)}<span style="color:${color}">${escapeHtml(data.imdbRating)}</span></span>`);
  }

  const rt = parseFloat(data.rottenTomatoesScore);
  if (!isNaN(rt)) {
    const color = scoreToColor(rt);
    parts.push(`<span class="hb-score">${rtIcon(rt, 14)}<span style="color:${color}">${escapeHtml(data.rottenTomatoesScore)}%</span></span>`);
  }

  const mc = parseFloat(data.metacriticScore);
  if (!isNaN(mc)) {
    const color = scoreToColor(mc);
    parts.push(`<span class="hb-score">${mcIcon(14)}<span style="color:${color}">${escapeHtml(data.metacriticScore)}</span></span>`);
  }

  if (parts.length === 0) return '';

  return parts.join('<span class="hb-sep"></span>');
}

function createBadgeStyles(): string {
  return `
    :host {
      position: absolute;
      bottom: 8px;
      left: 8px;
      z-index: 10;
      pointer-events: none;
    }
    .hb-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 4px;
      background: rgba(20, 20, 20, 0.88);
      backdrop-filter: blur(4px);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      color: #e5e5e5;
      line-height: 1;
      white-space: nowrap;
    }
    .hb-score {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .hb-sep {
      width: 1px;
      height: 12px;
      background: rgba(255, 255, 255, 0.3);
    }
    .hb-icon {
      width: 14px;
      height: 14px;
    }
  `;
}

function extractNetflixId(modal: Element): string | null {
  // Look for any link with /title/ or /watch/ in the hover card
  const links = modal.querySelectorAll('a[href*="/title/"], a[href*="/watch/"]');
  for (const link of links) {
    const href = link.getAttribute('href') || '';
    const match = href.match(/\/(?:title|watch)\/(\d+)/);
    if (match) return match[1];
  }

  // Check button data-uia attributes containing video IDs
  const buttons = modal.querySelectorAll('button[data-uia]');
  for (const btn of buttons) {
    const uia = btn.getAttribute('data-uia') || '';
    const match = uia.match(/(\d{6,})/);
    if (match) return match[1];
  }

  // Check data-video-id attribute
  const videoIdEl = modal.querySelector('[data-video-id]');
  if (videoIdEl) {
    const id = videoIdEl.getAttribute('data-video-id');
    if (id) return id;
  }

  return null;
}

const UI_LABELS = new Set([
  'play', 'resume', 'next episode', 'watch now', 'watch',
  'add to my list', 'remove from my list', 'rate', 'share',
  'more info', 'info', 'close', 'mute', 'unmute', 'audio & subtitles',
  'thumbs up', 'thumbs down', 'not for me', 'love this',
  'new episode', 'new season', 'recently added', 'watch now',
]);

function isUILabel(text: string): boolean {
  return UI_LABELS.has(text.toLowerCase().trim());
}

function extractHoverTitle(modal: Element): string | null {
  // Title treatment image alt text (the logo overlaid on the preview)
  const logoSelectors = [
    'img[class*="titleTreatment"]',
    'img[class*="title-treatment"]',
    'img[alt][class*="logo"]',
  ];
  for (const sel of logoSelectors) {
    const img = modal.querySelector(sel);
    if (img) {
      const alt = img.getAttribute('alt');
      if (alt && !isUILabel(alt)) return alt;
    }
  }

  // Any img with meaningful alt text inside the player/image area
  const playerArea = modal.querySelector('[class*="player"], [class*="boxart"], [class*="artwork"]');
  if (playerArea) {
    const img = playerArea.querySelector('img[alt]');
    if (img) {
      const alt = img.getAttribute('alt');
      if (alt && alt.length > 1 && !isUILabel(alt)) return alt;
    }
  }

  // aria-label on the modal itself (skip if it's a UI label)
  const ownLabel = modal.getAttribute('aria-label');
  if (ownLabel && !isUILabel(ownLabel)) return ownLabel;

  // aria-label on non-interactive elements (skip buttons, links, inputs)
  const allLabeled = modal.querySelectorAll('[aria-label]');
  for (const el of allLabeled) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'button' || tag === 'a' || tag === 'input' || el.getAttribute('role') === 'button') continue;
    const label = el.getAttribute('aria-label');
    if (label && label.length > 1 && !isUILabel(label)) return label;
  }

  // Any img with alt text anywhere in the modal
  const anyImg = modal.querySelector('img[alt]');
  if (anyImg) {
    const alt = anyImg.getAttribute('alt');
    if (alt && alt.length > 1 && !isUILabel(alt)) return alt;
  }

  // Modal title data attribute
  const modalTitle = modal.querySelector('[data-uia="modal-title"]');
  if (modalTitle) {
    const text = modalTitle.textContent?.trim();
    if (text && text.length > 1 && !isUILabel(text)) return text;
  }

  // Heading elements near top of modal
  for (const tag of ['h2', 'h3']) {
    const heading = modal.querySelector(tag);
    if (heading) {
      const text = heading.textContent?.trim();
      if (text && text.length > 1 && !isUILabel(text)) return text;
    }
  }

  // Strong element text near top of modal
  const strong = modal.querySelector('strong');
  if (strong) {
    const text = strong.textContent?.trim();
    if (text && text.length > 1 && !isUILabel(text)) return text;
  }

  return null;
}

function findImageContainer(modal: Element): Element | null {
  // Find the image/video preview area of the hover card
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
    if (el) {
      // Walk up to find a positioned container
      let target = el as HTMLElement;
      while (target && target !== modal) {
        const pos = getComputedStyle(target).position;
        if (pos === 'relative' || pos === 'absolute') return target;
        target = target.parentElement!;
      }
      return el;
    }
  }
  return null;
}

async function fetchRating(netflixId: string | null, title: string | null): Promise<RatingsData | null> {
  if (!netflixId && !title) {
    console.debug('[NFR] hover: no ID or title to fetch');
    return null;
  }
  try {
    const message: Message = {
      type: 'GET_RATINGS',
      payload: {
        title: title || '',
        netflixId: netflixId || undefined,
      },
    };
    const response = await browser.runtime.sendMessage(message) as MessageResponse;
    if (response.type === 'RATINGS' && response.data) {
      return response.data;
    }
    console.debug('[NFR] hover: no rating data for', title, response.type === 'RATINGS' ? response.status : '');
  } catch (err) {
    console.debug('[NFR] hover: fetch error for', title, err);
  }
  return null;
}

function hasVisibleTileBadge(modal: Element): boolean {
  const badge = modal.querySelector('nfr-badge') as HTMLElement | null;
  if (!badge) return false;
  const rect = badge.getBoundingClientRect();
  if (rect.height === 0) return false;
  const imageArea = findImageContainer(modal);
  if (imageArea && imageArea.contains(badge)) return true;
  badge.remove();
  return false;
}

function injectBadge(modal: Element, data: RatingsData): void {
  if (hasVisibleTileBadge(modal)) {
    console.debug('[NFR] hover: tile badge already visible, skipping injection');
    return;
  }

  // Remove any remaining stale tile badges
  modal.querySelectorAll('nfr-badge').forEach(el => el.remove());

  // Remove existing hover badges before re-injecting
  modal.querySelectorAll(HOVER_BADGE_TAG).forEach(el => el.remove());

  const html = createBadgeHTML(data);
  if (!html) return;

  const host = document.createElement(HOVER_BADGE_TAG);
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>${createBadgeStyles()}</style><div class="hb-badge">${html}</div>`;

  // Find image area and overlay on it
  const imageArea = findImageContainer(modal);
  if (imageArea) {
    const el = imageArea as HTMLElement;
    if (getComputedStyle(el).position === 'static') {
      el.style.position = 'relative';
    }
    el.appendChild(host);
  } else {
    // Fallback: overlay on modal itself
    const modalEl = modal as HTMLElement;
    if (getComputedStyle(modalEl).position === 'static') {
      modalEl.style.position = 'relative';
    }
    modalEl.appendChild(host);
  }
}

function watchForLateTileBadge(modal: Element): void {
  const obs = new MutationObserver(() => {
    const tileBadge = modal.querySelector('nfr-badge') as HTMLElement | null;
    if (tileBadge && tileBadge.getBoundingClientRect().height > 0) {
      modal.querySelectorAll(HOVER_BADGE_TAG).forEach(el => el.remove());
      obs.disconnect();
    }
  });
  obs.observe(modal, { childList: true, subtree: true });
  setTimeout(() => obs.disconnect(), 2000);
}

function processHoverCard(modal: Element): void {
  // Size gate: skip undersized modals (not yet hydrated), allow retry
  const rect = modal.getBoundingClientRect();
  if (rect.width < 100 || rect.height < 80) return;

  const netflixId = extractNetflixId(modal);
  const title = extractHoverTitle(modal);

  // Content gate: require title to prevent ghost modals from poisoning cache
  if (!title) {
    if (netflixId) console.debug('[NFR] hover: skipping titleless modal', { netflixId });
    return;
  }

  // Dedupe gate: suppress rapid reprocessing of same content
  pruneProcessedMap();
  const key = makeDedupeKey(netflixId, title)!;
  if (isDuplicate(key)) return;
  processedMap.set(key, Date.now());

  console.debug('[NFR] hover: processing', { title, netflixId });

  fetchRating(netflixId, title).then(data => {
    if (!data) {
      console.debug('[NFR] hover: no data for', title || netflixId);
      return;
    }
    // Wait for Netflix to finish reparenting tile badge
    setTimeout(() => {
      requestAnimationFrame(() => {
        if (hasVisibleTileBadge(modal)) {
          console.debug('[NFR] hover: tile badge appeared after stabilization, skipping');
          return;
        }
        injectBadge(modal, data);
        watchForLateTileBadge(modal);
      });
    }, 150);
  });
}

export function createHoverObserver(): MutationObserver {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const observer = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      // Collect all matching modals, deduplicate nested ones
      const allModals: Element[] = [];
      for (const selector of HOVER_SELECTORS) {
        document.querySelectorAll(selector).forEach(m => allModals.push(m));
      }
      const outerOnly = allModals.filter(m =>
        !allModals.some(other => other !== m && other.contains(m))
      );
      outerOnly.forEach(modal => processHoverCard(modal));
    }, 50);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return observer;
}
