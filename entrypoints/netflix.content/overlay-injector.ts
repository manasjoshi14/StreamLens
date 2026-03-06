import type { RatingsData, BadgeState } from '../../lib/types';
import { escapeHtml } from '../../lib/sanitize';
import { markProcessed } from './tile-detector';
import { imdbIcon, rtIcon, mcIcon, scoreToColor } from './icons';

const BADGE_TAG = 'nfr-badge';

function parseScore(value: string): number | null {
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

function createBadgeStyles(): string {
  return `
    :host {
      position: absolute;
      bottom: 4px;
      left: 4px;
      z-index: 10;
      pointer-events: auto;
    }
    .nfr-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 3px 8px;
      border-radius: 4px;
      background: rgba(20, 20, 20, 0.88);
      backdrop-filter: blur(4px);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      font-weight: 600;
      color: #e5e5e5;
      cursor: pointer;
      transition: transform 150ms ease, background 150ms ease;
      line-height: 1;
      white-space: nowrap;
    }
    .nfr-badge:hover {
      background: rgba(40, 40, 40, 0.95);
      transform: scale(1.05);
    }
    .nfr-score {
      display: flex;
      align-items: center;
      gap: 3px;
    }
    .nfr-separator {
      width: 1px;
      height: 10px;
      background: rgba(255, 255, 255, 0.3);
    }
    .nfr-icon {
      width: 12px;
      height: 12px;
    }
    .nfr-skeleton {
      background: linear-gradient(90deg, #333 25%, #444 50%, #333 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      width: 80px;
      height: 16px;
      border-radius: 3px;
    }
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .nfr-warning {
      color: #f5c518;
      font-size: 10px;
    }
    .nfr-na {
      color: #888;
      font-style: italic;
    }
    .nfr-status {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-style: normal;
    }
    .nfr-status.rate-limited { color: #f59e0b; }
    .nfr-status.error { color: #ef4444; }
  `;
}

function createBadgeHTML(state: BadgeState, data?: RatingsData): string {
  switch (state) {
    case 'loading':
      return `<div class="nfr-badge"><div class="nfr-skeleton"></div></div>`;
    case 'na':
      return `<div class="nfr-badge"><span class="nfr-na">N/A</span></div>`;
    case 'error':
      return `<div class="nfr-badge"><span class="nfr-status error"><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Error</span></div>`;
    case 'rate-limited':
      return `<div class="nfr-badge"><span class="nfr-status rate-limited"><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M8 4v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="11.5" r="0.75" fill="currentColor"/></svg>Rate limit</span></div>`;
    case 'low-confidence':
    case 'rated': {
      if (!data) return `<div class="nfr-badge"><span class="nfr-na">N/A</span></div>`;
      const parts: string[] = [];

      const imdbNum = parseScore(data.imdbRating);
      if (imdbNum !== null) {
        const color = scoreToColor(imdbNum * 10);
        parts.push(`<span class="nfr-score">${imdbIcon(12)}<span style="color:${color}">${escapeHtml(data.imdbRating)}</span></span>`);
      }

      const rtNum = parseScore(data.rottenTomatoesScore);
      if (rtNum !== null) {
        const color = scoreToColor(rtNum);
        parts.push(`<span class="nfr-score">${rtIcon(rtNum, 12)}<span style="color:${color}">${escapeHtml(data.rottenTomatoesScore)}%</span></span>`);
      }

      const mcNum = parseScore(data.metacriticScore);
      if (mcNum !== null) {
        const color = scoreToColor(mcNum);
        parts.push(`<span class="nfr-score">${mcIcon(12)}<span style="color:${color}">${escapeHtml(data.metacriticScore)}</span></span>`);
      }

      if (parts.length === 0) {
        return `<div class="nfr-badge"><span class="nfr-na">N/A</span></div>`;
      }

      const warning = state === 'low-confidence' ? '<span class="nfr-warning">?</span>' : '';
      const separatedParts = parts.join('<span class="nfr-separator"></span>');
      return `<div class="nfr-badge">${separatedParts}${warning}</div>`;
    }
  }
}

export function injectBadge(
  tile: Element,
  state: BadgeState,
  data?: RatingsData,
  onClick?: (data: RatingsData) => void
): void {
  markProcessed(tile);

  const tileEl = tile as HTMLElement;
  const computed = getComputedStyle(tileEl);
  if (computed.position === 'static') {
    tileEl.style.position = 'relative';
  }

  let host = tile.querySelector(BADGE_TAG) as HTMLElement | null;
  if (!host) {
    host = document.createElement(BADGE_TAG);
    tile.appendChild(host);
  }

  let shadow = host.shadowRoot;
  if (!shadow) {
    shadow = host.attachShadow({ mode: 'open' });
  }

  shadow.innerHTML = `<style>${createBadgeStyles()}</style>${createBadgeHTML(state, data)}`;

  if (data && onClick) {
    const badge = shadow.querySelector('.nfr-badge');
    if (badge) {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick(data);
      });
    }
  }
}

export function updateBadge(tile: Element, state: BadgeState, data?: RatingsData, onClick?: (data: RatingsData) => void): void {
  injectBadge(tile, state, data, onClick);
}
