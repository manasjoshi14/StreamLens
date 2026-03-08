import type { RatingsData, Review } from '../../lib/types';
import type { Message, MessageResponse } from '../../lib/messages';
import { PANEL_WIDTH, REVIEW_PREVIEW_LENGTH, MAX_REVIEWS } from '../../lib/constants';
import { escapeHtml, escapeAttr, sanitizeImdbId, sanitizeHttpsUrl } from '../../lib/sanitize';
import { imdbIcon, rtIcon, mcIcon, scoreToColor } from './icons';

const PANEL_TAG = 'nfr-review-panel';

let currentPanel: HTMLElement | null = null;
let currentShadow: ShadowRoot | null = null;
let outsideClickHandler: ((e: MouseEvent) => void) | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;
let panelSessionId = 0;
let shadowClickHandlerBound = false;

function panelStyles(): string {
  return `
    :host {
      position: fixed;
      top: 0;
      right: 0;
      width: ${PANEL_WIDTH}px;
      height: 100vh;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .nfr-panel {
      width: 100%;
      height: 100%;
      background: rgba(20, 20, 20, 0.96);
      color: #e5e5e5;
      overflow-y: auto;
      transform: translateX(100%);
      transition: transform 300ms ease;
      box-shadow: -4px 0 20px rgba(0, 0, 0, 0.5);
    }
    .nfr-panel.open {
      transform: translateX(0);
    }
    .nfr-panel-header {
      position: sticky;
      top: 0;
      background: rgba(20, 20, 20, 0.98);
      padding: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      z-index: 1;
    }
    .nfr-close {
      background: none;
      border: none;
      color: #e5e5e5;
      font-size: 24px;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
      opacity: 0.7;
      transition: opacity 150ms;
    }
    .nfr-close:hover { opacity: 1; }
    .nfr-title {
      font-size: 20px;
      font-weight: 700;
      margin: 0 0 4px 0;
      line-height: 1.2;
    }
    .nfr-meta {
      font-size: 13px;
      color: #999;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .nfr-ratings {
      display: flex;
      gap: 16px;
      padding: 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .nfr-rating-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .nfr-rating-value {
      font-size: 24px;
      font-weight: 700;
    }
    .nfr-rating-label {
      font-size: 11px;
      color: #999;
      text-transform: uppercase;
    }
    .nfr-rating-icon {
      display: flex;
      align-items: center;
    }
    .nfr-poster {
      width: 100%;
      max-height: 200px;
      object-fit: contain;
      background: #111;
    }
    .nfr-section {
      padding: 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .nfr-section-title {
      font-size: 14px;
      font-weight: 600;
      color: #999;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .nfr-plot {
      font-size: 14px;
      line-height: 1.5;
      color: #ccc;
    }
    .nfr-review {
      padding: 12px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .nfr-review:last-child { border-bottom: none; }
    .nfr-review-author {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .nfr-review-content {
      font-size: 13px;
      line-height: 1.5;
      color: #bbb;
    }
    .nfr-read-more {
      color: #e50914;
      cursor: pointer;
      font-size: 12px;
      background: none;
      border: none;
      padding: 4px 0;
      font-weight: 600;
    }
    .nfr-read-more:hover { text-decoration: underline; }
    .nfr-links {
      display: flex;
      gap: 10px;
      padding: 16px;
    }
    .nfr-link {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 6px 12px;
      border-radius: 6px;
      background: #1a1a1a;
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #e5e5e5;
      font-size: 12px;
      font-weight: 500;
      text-decoration: none;
      transition: background 150ms, border-color 150ms;
      cursor: pointer;
    }
    .nfr-link:hover {
      background: #222;
      border-color: rgba(255, 255, 255, 0.15);
    }
    .nfr-link svg {
      width: 14px;
      height: 14px;
    }
    .nfr-link-arrow {
      font-size: 10px;
      opacity: 0.5;
    }
    .nfr-no-reviews {
      color: #888;
      font-size: 14px;
      font-style: italic;
      padding: 8px 0;
    }
    .nfr-skeleton-block {
      background: linear-gradient(90deg, #333 25%, #444 50%, #333 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
      height: 16px;
      margin-bottom: 8px;
    }
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `;
}

function truncateReview(content: string): { text: string; truncated: boolean } {
  if (content.length <= REVIEW_PREVIEW_LENGTH) return { text: content, truncated: false };
  return {
    text: content.slice(0, REVIEW_PREVIEW_LENGTH).replace(/\s+\S*$/, '') + '...',
    truncated: true,
  };
}

function renderRatings(data: RatingsData): string {
  const items: string[] = [];

  if (data.imdbRating && data.imdbRating !== 'N/A') {
    const imdbNum = parseFloat(data.imdbRating);
    const color = !isNaN(imdbNum) ? scoreToColor(imdbNum * 10) : '#f5c518';
    items.push(`
      <div class="nfr-rating-item">
        <span class="nfr-rating-icon">${imdbIcon(16)}</span>
        <span class="nfr-rating-value" style="color:${color}">${escapeHtml(data.imdbRating)}</span>
        <span class="nfr-rating-label">IMDb</span>
      </div>
    `);
  }

  if (data.rottenTomatoesScore && data.rottenTomatoesScore !== 'N/A') {
    const rtNum = parseFloat(data.rottenTomatoesScore);
    const color = !isNaN(rtNum) ? scoreToColor(rtNum) : '#ccc';
    items.push(`
      <div class="nfr-rating-item">
        <span class="nfr-rating-icon">${rtIcon(rtNum, 16)}</span>
        <span class="nfr-rating-value" style="color:${color}">${escapeHtml(data.rottenTomatoesScore)}%</span>
        <span class="nfr-rating-label">Rotten Tomatoes</span>
      </div>
    `);
  }

  if (data.metacriticScore && data.metacriticScore !== 'N/A') {
    const mcNum = parseFloat(data.metacriticScore);
    const color = !isNaN(mcNum) ? scoreToColor(mcNum) : '#ccc';
    items.push(`
      <div class="nfr-rating-item">
        <span class="nfr-rating-icon">${mcIcon(16)}</span>
        <span class="nfr-rating-value" style="color:${color}">${escapeHtml(data.metacriticScore)}</span>
        <span class="nfr-rating-label">Metacritic</span>
      </div>
    `);
  }

  return items.length > 0 ? `<div class="nfr-ratings">${items.join('')}</div>` : '';
}

function renderReviews(reviews: Review[]): string {
  if (reviews.length === 0) {
    return `<div class="nfr-no-reviews">No reviews yet</div>`;
  }

  return reviews.slice(0, MAX_REVIEWS).map(review => {
    const { text, truncated } = truncateReview(review.content);
    return `
      <div class="nfr-review">
        <div class="nfr-review-author">${escapeHtml(review.author)}${review.rating !== null ? ` - ${review.rating}/10` : ''}</div>
        <div class="nfr-review-content" data-full="${escapeAttr(review.content)}" data-truncated="true">${escapeHtml(text)}</div>
        ${truncated ? '<button class="nfr-read-more">Read more</button>' : ''}
      </div>
    `;
  }).join('');
}

function renderLinks(data: RatingsData): string {
  const imdbId = data.imdbId ? sanitizeImdbId(data.imdbId) : null;
  const imdbUrl = imdbId ? `https://www.imdb.com/title/${imdbId}/` : '';
  const rtUrl = `https://www.google.com/search?q=${encodeURIComponent(data.title + ' ' + data.year + ' site:rottentomatoes.com')}`;
  const mcUrl = `https://www.metacritic.com/search/${encodeURIComponent(data.title)}/`;

  const rtNum = parseFloat(data.rottenTomatoesScore);

  return `
    <div class="nfr-links">
      ${imdbUrl ? `<a class="nfr-link" href="${escapeAttr(imdbUrl)}" target="_blank" rel="noopener">${imdbIcon(14)} IMDb <span class="nfr-link-arrow">Open</span></a>` : ''}
      <a class="nfr-link" href="${escapeAttr(rtUrl)}" target="_blank" rel="noopener">${rtIcon(!isNaN(rtNum) ? rtNum : 100, 14)} Rotten Tomatoes <span class="nfr-link-arrow">Open</span></a>
      <a class="nfr-link" href="${escapeAttr(mcUrl)}" target="_blank" rel="noopener">${mcIcon(14)} Metacritic <span class="nfr-link-arrow">Open</span></a>
    </div>
  `;
}

function renderLoading(): string {
  return `
    <div class="nfr-section">
      <div class="nfr-skeleton-block" style="width:60%"></div>
      <div class="nfr-skeleton-block" style="width:80%"></div>
      <div class="nfr-skeleton-block" style="width:40%"></div>
    </div>
  `;
}

function handleShadowClick(e: Event): void {
  const target = e.target as HTMLElement;
  if (!target.classList.contains('nfr-read-more')) return;

  const review = target.previousElementSibling as HTMLElement | null;
  if (review && review.dataset.truncated === 'true') {
    review.textContent = review.dataset.full || '';
    review.dataset.truncated = 'false';
    target.textContent = 'Show less';
    return;
  }

  if (review) {
    const { text } = truncateReview(review.dataset.full || '');
    review.textContent = text;
    review.dataset.truncated = 'true';
    target.textContent = 'Read more';
  }
}

function renderReviewsUnavailable(section: HTMLElement): void {
  section.innerHTML = `
    <div class="nfr-section-title">Reviews</div>
    <div class="nfr-no-reviews">Reviews unavailable</div>
  `;
}

export function openPanel(data: RatingsData): void {
  panelSessionId++;
  const sessionId = panelSessionId;

  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }

  if (!currentPanel) {
    currentPanel = document.createElement(PANEL_TAG);
    document.body.appendChild(currentPanel);
    currentShadow = currentPanel.attachShadow({ mode: 'open' });
    shadowClickHandlerBound = false;
  }

  if (currentShadow && !shadowClickHandlerBound) {
    currentShadow.addEventListener('click', handleShadowClick);
    shadowClickHandlerBound = true;
  }

  const posterUrl = data.poster && data.poster !== 'N/A' ? sanitizeHttpsUrl(data.poster) : null;
  const posterHtml = posterUrl
    ? `<img class="nfr-poster" src="${escapeAttr(posterUrl)}" alt="${escapeAttr(data.title)}" loading="lazy" referrerpolicy="no-referrer" crossorigin="anonymous">`
    : '';

  currentShadow!.innerHTML = `
    <style>${panelStyles()}</style>
    <div class="nfr-panel" id="panel">
      <div class="nfr-panel-header">
        <div>
          <h2 class="nfr-title">${escapeHtml(data.title)}</h2>
          <div class="nfr-meta">
            ${data.year && data.year !== 'N/A' ? `<span>${escapeHtml(data.year)}</span>` : ''}
            ${data.rated && data.rated !== 'N/A' ? `<span>${escapeHtml(data.rated)}</span>` : ''}
            ${data.runtime && data.runtime !== 'N/A' ? `<span>${escapeHtml(data.runtime)}</span>` : ''}
            ${data.genre && data.genre !== 'N/A' ? `<span>${escapeHtml(data.genre)}</span>` : ''}
          </div>
        </div>
        <button class="nfr-close" id="close-btn">x</button>
      </div>
      ${posterHtml}
      ${renderRatings(data)}
      ${data.plot && data.plot !== 'N/A' ? `
        <div class="nfr-section">
          <div class="nfr-section-title">Plot</div>
          <div class="nfr-plot">${escapeHtml(data.plot)}</div>
        </div>
      ` : ''}
      <div class="nfr-section" id="reviews-section">
        <div class="nfr-section-title">Reviews</div>
        ${renderLoading()}
      </div>
      ${renderLinks(data)}
    </div>
  `;

  const panel = currentShadow!.getElementById('panel')!;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      panel.classList.add('open');
    });
  });

  currentShadow!.getElementById('close-btn')!.addEventListener('click', closePanel);

  if (outsideClickHandler) {
    document.removeEventListener('click', outsideClickHandler);
  }
  outsideClickHandler = (e: MouseEvent) => {
    const path = e.composedPath();
    if (currentPanel && !path.includes(currentPanel)) {
      closePanel();
    }
  };
  setTimeout(() => {
    if (outsideClickHandler) document.addEventListener('click', outsideClickHandler);
  }, 0);

  fetchAndRenderReviews(data, sessionId);
}

async function fetchAndRenderReviews(data: RatingsData, sessionId: number): Promise<void> {
  try {
    const message: Message = {
      type: 'GET_REVIEWS',
      payload: {
        title: data.title,
        imdbId: data.imdbId,
        mediaType: data.type,
      },
    };

    const response = await browser.runtime.sendMessage(message) as MessageResponse;

    if (!currentShadow || sessionId !== panelSessionId) return;
    const section = currentShadow.getElementById('reviews-section');
    if (!section) return;

    if (response.type === 'REVIEWS' && response.data) {
      section.innerHTML = `
        <div class="nfr-section-title">Reviews</div>
        ${renderReviews(response.data.reviews)}
      `;
      return;
    }

    renderReviewsUnavailable(section);
  } catch {
    if (!currentShadow || sessionId !== panelSessionId) return;
    const section = currentShadow.getElementById('reviews-section');
    if (section) {
      renderReviewsUnavailable(section);
    }
  }
}

export function closePanel(): void {
  if (outsideClickHandler) {
    document.removeEventListener('click', outsideClickHandler);
    outsideClickHandler = null;
  }

  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }

  if (!currentShadow) return;

  const panel = currentShadow.getElementById('panel');
  if (!panel) {
    currentPanel?.remove();
    currentPanel = null;
    currentShadow = null;
    shadowClickHandlerBound = false;
    return;
  }

  panel.classList.remove('open');
  closeTimer = setTimeout(() => {
    currentPanel?.remove();
    currentPanel = null;
    currentShadow = null;
    closeTimer = null;
    shadowClickHandlerBound = false;
  }, 300);
}

export function isPanelOpen(): boolean {
  return currentPanel !== null;
}

export function setupPanelKeyboard(): void {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isPanelOpen()) {
      closePanel();
    }
  });
}
