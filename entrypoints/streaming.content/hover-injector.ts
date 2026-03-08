import type { RatingsData, DetailInfo, StreamingProvider } from '../../lib/types';
import type { Message, MessageResponse } from '../../lib/messages';
import { escapeHtml } from '../../lib/sanitize';
import { imdbIcon, rtIcon, mcIcon, scoreToColor } from './icons';

const DETAIL_BADGE_TAG = 'nfr-detail-badge';
export const processedMap = new Map<string, number>();

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
  `;
}

export function makeDedupeKey(providerId: string, detail: DetailInfo): string | null {
  const context = detail.context || 'detail';
  if (detail.title) return `${providerId}:${context}:${detail.title.toLowerCase().trim()}`;
  if (detail.contentId) return `${providerId}:${context}:${detail.contentId}`;
  return null;
}

export function isDuplicate(key: string, cooldownMs: number): boolean {
  const lastSeen = processedMap.get(key);
  if (lastSeen == null) return false;
  return (Date.now() - lastSeen) < cooldownMs;
}

function pruneProcessedMap(maxAgeMs: number): void {
  if (processedMap.size <= 50) return;
  const now = Date.now();
  for (const [key, ts] of processedMap) {
    if (now - ts > maxAgeMs) processedMap.delete(key);
  }
}

function collectOuterTargets(selectors: readonly string[]): Element[] {
  const allTargets: Element[] = [];
  for (const selector of selectors) {
    document.querySelectorAll(selector).forEach(target => allTargets.push(target));
  }

  return allTargets.filter(target => !allTargets.some(other => other !== target && other.contains(target)));
}

async function fetchRating(providerId: string, detail: DetailInfo): Promise<RatingsData | null> {
  if (!detail.title && !detail.contentId) return null;

  try {
    const message: Message = {
      type: 'GET_RATINGS',
      payload: {
        providerId,
        title: detail.title || '',
        contentId: detail.contentId,
      },
    };
    const response = await browser.runtime.sendMessage(message) as MessageResponse;
    if (response.type === 'RATINGS' && response.data) return response.data;
  } catch (err) {
    console.debug('[NFR] detail fetch error:', detail.title, err);
  }

  return null;
}

function hasVisibleTileBadge(target: Element, anchor: Element): boolean {
  const badge = target.querySelector('nfr-badge') as HTMLElement | null;
  if (!badge) return false;
  const rect = badge.getBoundingClientRect();
  if (rect.height === 0) return false;
  if (anchor.contains(badge)) return true;
  badge.remove();
  return false;
}

function injectBadge(anchor: Element, data: RatingsData): void {
  const html = createBadgeHTML(data);
  if (!html) return;

  anchor.querySelectorAll(DETAIL_BADGE_TAG).forEach(el => el.remove());

  const host = document.createElement(DETAIL_BADGE_TAG);
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>${createBadgeStyles()}</style><div class="hb-badge">${html}</div>`;

  const element = anchor as HTMLElement;
  if (getComputedStyle(element).position === 'static') {
    element.style.position = 'relative';
  }
  element.appendChild(host);
}

function watchForLateTileBadge(target: Element): void {
  const observer = new MutationObserver(() => {
    const tileBadge = target.querySelector('nfr-badge') as HTMLElement | null;
    if (tileBadge && tileBadge.getBoundingClientRect().height > 0) {
      target.querySelectorAll(DETAIL_BADGE_TAG).forEach(el => el.remove());
      observer.disconnect();
    }
  });

  observer.observe(target, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 2_000);
}

function processDetailTarget(provider: StreamingProvider, target: Element): void {
  const rect = target.getBoundingClientRect();
  if (rect.width < 100 || rect.height < 80) return;

  const detail = provider.extractDetailInfo(target);
  if (!detail?.title) return;

  const cooldownMs = provider.getDetailCooldownMs?.(detail) ?? 1_200;
  pruneProcessedMap(Math.max(cooldownMs, 30_000));

  const key = makeDedupeKey(provider.id, detail);
  if (!key || isDuplicate(key, cooldownMs)) return;
  processedMap.set(key, Date.now());

  fetchRating(provider.id, detail).then(data => {
    if (!data) return;

    setTimeout(() => {
      requestAnimationFrame(() => {
        const anchor = provider.findDetailBadgeAnchor(target) || target;
        if (hasVisibleTileBadge(target, anchor)) return;
        injectBadge(anchor, data);
        watchForLateTileBadge(target);
      });
    }, 150);
  });
}

export function createHoverObserver(provider: StreamingProvider): MutationObserver {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const observer = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      collectOuterTargets(provider.detailSelectors).forEach(target => processDetailTarget(provider, target));
    }, 50);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return observer;
}
